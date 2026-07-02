/**
 * Service source discovery (plan 018 G5). Registry/resources are the OUTPUT of
 * discovery, not authored seed: for every service on the availability spine, we
 * probe its Terraform module at the registry and record what we find. Most
 * services have no module (the registry 404s) → `module: null`, which the
 * derivation engine turns into an honest gap.
 *
 * This is the descriptive half (which module exists / its TOC). The normative
 * half (which heading backs which section) is the kernel's `SECTION_RULES`,
 * applied in `deriveResources`. The only fetch target is the source system
 * (the Terraform registry, prod real / dev MSW), reached through `ctx.fetch`.
 */
import type { ServiceIdentity } from "@atlas/schema";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import { normalizeServiceIdentity } from "../services/serviceIdentityNormalizer";
import type { ResolutionContext } from "../resolvers/resolverTypes";
import { discoverTerraformModule } from "../sourceContent/terraformModuleContentProvider";

/** A discovered Terraform module README for one service (descriptive facts only). */
export type DiscoveredModule = {
  /** Synthetic source id derived from the module name — the binding `source_id`. */
  sourceId: string;
  /** The module name (the `<name>` segment) — a service can have several. */
  name: string;
  /** Host-less registry address (`<namespace>/<name>/<provider>`) — the source location. */
  address: string;
  /** The README's full ordered heading list (raw TOC). */
  headings: string[];
  /** The README's lead paragraph — the service's one-line description, if present. */
  summary?: string;
  /** The module's published version, if the registry reported one. */
  version?: string;
};

/**
 * One service's discovery result: its identity + every module found for it. A
 * service maps to ZERO OR MORE modules (e.g. a bedrock-agentcore service backed by
 * several modules) — the map value is a list, and each mapped module that resolves
 * becomes an entry here; an unmapped / all-404 service has an empty `modules`.
 */
export type DiscoveredService = {
  identity: ServiceIdentity;
  /** The service's availability domain (e.g. "Storage") — its presentation category. */
  domain: string;
  modules: DiscoveredModule[];
};

export type DiscoverServiceSourcesDeps = {
  /** The service spine — discovery iterates whatever this returns (N is data). */
  availabilityProvider: AvailabilityProvider;
  /** Late-bound fetch context (dev MSW / prod real / unit fake). */
  ctx: ResolutionContext;
  /**
   * Terraform registry deployment config. `baseUrl`/`token` are the host + credential
   * (never a source location). `org` is the registry namespace (the private registry
   * org, e.g. the `<namespace>` segment). `moduleMap` is the EXPLICIT service→module
   * mapping (`identity.key` → module names): real module names don't follow the
   * service id (`alb_module`, `aurora-postgres`, and `bedrock` vs
   * `bedrock-agentcore-gateway` collide under any fuzzy rule), and a service can have
   * SEVERAL modules — so the value is a LIST and a service is bound to modules ONLY
   * through this map (no entry → honest gap).
   */
  terraform: { baseUrl: string; token: string; org: string; moduleMap: Record<string, string[]> };
};

/** A spine service paired with the availability domain it carries (presentation). */
type SpineService = { identity: ServiceIdentity; domain: string };

/**
 * Probe every spine service for a Terraform module. The spine is the wired
 * landing zones' availability grids flattened: each `AvailabilityRecord` carries
 * `{id, name, domain}`, normalized to a canonical `ServiceIdentity` (provider =
 * the LZ's cloud) and deduped by `identity.key` (first occurrence wins) — the
 * `domain` is captured for presentation (`category`). The module address follows
 * the `example/<id>/<provider>` convention; a service with no published module
 * yields `module: null`. Probes run concurrently — one registry fetch per service.
 */
export async function discoverServiceSources(
  deps: DiscoverServiceSourcesDeps,
): Promise<DiscoveredService[]> {
  const { availabilityProvider, ctx, terraform } = deps;
  const spine = flattenSpine(await availabilityProvider.getZones());

  // Honest-gap (ADR-0006, plan 018): with no Terraform channel / org configured, no
  // module is discoverable — every service resolves an empty `modules` rather than
  // building a relative `/api/registry/...` URL that `globalThis.fetch` rejects
  // in Node and would fail the entire discovery pass (and get cached rejected).
  if (!terraform.baseUrl || !terraform.org) {
    return spine.map(({ identity, domain }) => ({ identity, domain, modules: [] }));
  }

  const config = { baseUrl: terraform.baseUrl, token: terraform.token };
  return Promise.all(
    spine.map(async ({ identity, domain }) => {
      // A service is bound to modules ONLY through the explicit map — no entry is
      // an honest gap (never a guessed `<id>` address that mis-binds or 404-spams).
      // A service can map to SEVERAL modules; each is probed independently.
      const moduleNames = terraform.moduleMap[identity.key] ?? [];
      const probed = await Promise.all(
        moduleNames.map(async (name): Promise<DiscoveredModule | null> => {
          const address = `${terraform.org}/${name}/${identity.provider}`;
          // A probe that throws (registry unreachable, DNS failure) is an honest gap
          // for THAT module — never a rejected discovery that fails every route.
          const found = await discoverTerraformModule(ctx, config, address).catch(() => null);
          return found
            ? {
                sourceId: `${name}-module-readme`,
                name,
                address,
                headings: found.headings,
                summary: found.summary,
                version: found.version,
              }
            : null;
        }),
      );
      const modules = probed.filter((module): module is DiscoveredModule => module !== null);
      return { identity, domain, modules };
    }),
  );
}

/**
 * Flatten the wired zones' services into the discovery spine: one normalized
 * `ServiceIdentity` per service (provider = the LZ's cloud, the LZ id never enters
 * the address), deduped by canonical key (first wins). The service's `domain` is
 * captured alongside for presentation. Unwired zones carry no services → nothing.
 */
function flattenSpine(
  zones: Awaited<ReturnType<AvailabilityProvider["getZones"]>>,
): SpineService[] {
  const byKey = new Map<string, SpineService>();
  for (const zone of zones) {
    for (const service of zone.services) {
      const identity = normalizeServiceIdentity({
        provider: zone.cloud,
        id: service.id,
        name: service.name,
      });
      if (!byKey.has(identity.key)) {
        byKey.set(identity.key, { identity, domain: service.domain });
      }
    }
  }
  return Array.from(byKey.values());
}
