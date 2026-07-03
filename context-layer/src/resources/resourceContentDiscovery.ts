/**
 * Lazy, per-resource content discovery (plan 0.2.0).
 *
 * List discovery (the catalog / home / availability path) is content-FREE: it
 * enumerates resources from the availability spine, the Terraform module map, and
 * the security-space page listing WITHOUT fetching a single module README or policy
 * page (see `discoverSources` / `discoverGuardrails`). The descriptive CONTENT a
 * resource's Sections bind to — the document's heading TOC — is derived HERE, on
 * demand, only when a specific resource's context is read (a service/policy detail
 * view or an agent `/api/resources/{id}` read).
 *
 * One resource in → at most that ONE resource's own document(s) fetched. So the
 * expensive per-item fetch that used to fan out across the whole catalog on home
 * load now happens lazily, scoped to the resource actually being read.
 */
import type { ResourceContextRecord, ResourceSectionBinding } from "@atlas/schema";
import { deriveServiceResources } from "../discovery/deriveResources";
import { deriveGuardrailResources } from "../discovery/deriveGuardrails";
import type { DiscoveredModule } from "../discovery/discoverSources";
import { parseStorageHeadings } from "../discovery/discoverGuardrails";
import { discoverTerraformModule } from "../sourceContent/terraformModuleContentProvider";
import { fetchConfluenceStorageHtml } from "../sourceContent/confluenceCloudContentProvider";
import { normalizeServiceIdentity } from "../services/serviceIdentityNormalizer";
import { logger, serializeError } from "../observability/logging";
import type { ResolutionContext } from "../resolvers/resolverTypes";

/** The section bindings for ONE resource, derived from a live fetch of its backing
 *  document(s). Section CONTENT is still resolved by the resolver registry — this
 *  only produces the bindings (which heading backs which Section). */
export interface ResourceContentDiscovery {
  /**
   * Derive `record`'s section bindings by live-fetching its backing document(s).
   * Falls back to the record's list-derived sections (e.g. a service's
   * selector-based `availability` section, which needs no fetch) on any honest gap:
   * unconfigured channel, no mapped module / page id, or a failed fetch.
   */
  sectionsFor(
    record: ResourceContextRecord,
    ctx: ResolutionContext,
  ): Promise<Record<string, ResourceSectionBinding[]>>;
}

export type TerraformContentConfig = {
  baseUrl: string;
  token: string;
  /** Registry namespace (the `<namespace>` address segment). */
  org: string;
  /** Explicit `identity.key` → module name(s) map (same map list discovery uses). */
  moduleMap: Record<string, string[]>;
};

export type GuardrailContentConfig = { baseUrl: string; token: string; email?: string };

export type ResourceContentDiscoveryConfig = {
  terraform: TerraformContentConfig;
  guardrail: GuardrailContentConfig;
  /** guardrail slug → Confluence pageId, captured by the space-listing pass so the
   *  enricher can fetch exactly the one page a policy detail read needs. */
  guardrailPageIds: ReadonlyMap<string, string>;
};

export function createResourceContentDiscovery(
  config: ResourceContentDiscoveryConfig,
): ResourceContentDiscovery {
  const log = logger("discovery");
  return {
    async sectionsFor(record, ctx) {
      if (record.kind === "service") {
        return serviceSections(record, ctx, config.terraform, log);
      }
      if (record.kind === "guardrail") {
        return guardrailSections(record, ctx, config.guardrail, config.guardrailPageIds, log);
      }
      return record.sections;
    },
  };
}

/** The machine id half of a canonical `{provider}/{id}` slug. */
function slugId(slug: string): string {
  return slug.includes("/") ? slug.slice(slug.indexOf("/") + 1) : slug;
}

/**
 * Fetch a service's mapped module README(s) and derive its Section bindings. The
 * freshly-fetched terraform sections (`network` / `examples`) are overlaid on the
 * record's list-derived sections so the selector-based `availability` binding
 * (which needs no fetch) is preserved exactly.
 */
async function serviceSections(
  record: ResourceContextRecord,
  ctx: ResolutionContext,
  tf: TerraformContentConfig,
  log: ReturnType<typeof logger>,
): Promise<Record<string, ResourceSectionBinding[]>> {
  const names = tf.moduleMap[record.slug] ?? [];
  if (!tf.baseUrl || !tf.org || names.length === 0) {
    return record.sections; // honest gap — keep the list-derived (availability) sections
  }

  const provider = record.provider ?? record.slug.split("/")[0];
  const registryConfig = { baseUrl: tf.baseUrl, token: tf.token };
  const modules = (
    await Promise.all(
      names.map(async (name): Promise<DiscoveredModule | null> => {
        const address = `${tf.org}/${name}/${provider}`;
        const found = await discoverTerraformModule(ctx, registryConfig, address).catch((error) => {
          log.warn(
            { service: record.slug, address, err: serializeError(error) },
            `terraform enrich threw for ${address} — degraded to no module`,
          );
          return null;
        });
        if (!found) {
          return null;
        }
        return {
          sourceId: `${name}-module-readme`,
          name,
          address,
          headings: found.headings,
          summary: found.summary,
          version: found.version,
        };
      }),
    )
  ).filter((module): module is DiscoveredModule => module !== null);

  const identity = normalizeServiceIdentity({
    provider,
    id: slugId(record.slug),
    name: record.name,
  });
  const [derived] = deriveServiceResources([{ identity, domain: record.category ?? "", modules }]);
  if (!derived) {
    return record.sections;
  }
  // Overlay the fetched terraform sections; the record's list-derived availability
  // binding wins so it stays identical to what list discovery produced.
  return { ...derived.sections, ...record.sections };
}

/**
 * Fetch a guardrail's policy page and derive its Section bindings. The pageId comes
 * from the space-listing pass (captured at list-discovery time), so exactly one
 * page — the policy being read — is fetched.
 */
async function guardrailSections(
  record: ResourceContextRecord,
  ctx: ResolutionContext,
  cfg: GuardrailContentConfig,
  pageIds: ReadonlyMap<string, string>,
  log: ReturnType<typeof logger>,
): Promise<Record<string, ResourceSectionBinding[]>> {
  const pageId = pageIds.get(record.slug);
  if (!cfg.baseUrl || !cfg.token || !pageId) {
    return record.sections; // honest gap
  }
  const fetched = await fetchConfluenceStorageHtml(ctx, cfg, pageId);
  if (!fetched.ok) {
    log.warn(
      { guardrail: record.slug, pageId, code: fetched.code },
      `guardrail enrich fetch failed (${fetched.code}) — no governed sections`,
    );
    return record.sections;
  }
  const headings = parseStorageHeadings(fetched.html);
  const [derived] = deriveGuardrailResources([
    { slug: record.slug, name: record.name, pageId, headings },
  ]);
  return derived?.sections ?? record.sections;
}
