/**
 * Service source discovery (list-only, plan 0.2.0). The catalog/home path
 * enumerates services from the availability spine + the explicit Terraform module
 * map WITHOUT fetching a single module README. Each service is bound to its mapped
 * module ADDRESSES (host-less `<namespace>/<name>/<provider>`) — enough for the
 * registry Source records and the entry-tool links — but `headings`/`summary` stay
 * empty here.
 *
 * The descriptive CONTENT of a module (its heading TOC → section bindings, its
 * lead-paragraph description) is fetched LAZILY, per-service, only when that
 * service's context is read (a detail view or an agent `/api/resources/{id}` read)
 * — see `resourceContentDiscovery`. Nothing is fetched on the list build, so home/
 * catalog/availability never fan out one-fetch-per-module. The normative half
 * (which heading backs which section) is the kernel's `SECTION_RULES`, applied in
 * `deriveResources` at enrichment time.
 */
import type { ServiceIdentity } from "@atlas/schema";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import { normalizeServiceIdentity } from "../services/serviceIdentityNormalizer";
import { logger } from "../observability/logging";
import type { ResolutionContext } from "../resolvers/resolverTypes";

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
 * List every spine service with its mapped Terraform module ADDRESSES — no fetch.
 * The spine is the wired landing zones' availability grids flattened: each
 * `AvailabilityRecord` carries `{id, name, domain}`, normalized to a canonical
 * `ServiceIdentity` (provider = the LZ's cloud) and deduped by `identity.key`
 * (first occurrence wins) — the `domain` is captured for presentation (`category`).
 * A service is bound to modules ONLY through the explicit map; each mapped module
 * becomes a `{sourceId, name, address}` with an EMPTY `headings` list (its README
 * is fetched lazily on detail read, not here). The module address follows the
 * `<org>/<name>/<provider>` convention.
 */
export async function discoverServiceSources(
  deps: DiscoverServiceSourcesDeps,
): Promise<DiscoveredService[]> {
  const { availabilityProvider, terraform } = deps;
  const log = logger("discovery");
  const spine = flattenSpine(await availabilityProvider.getZones());

  // Honest-gap (ADR-0006): with no Terraform channel / org configured, no module
  // address can be built — every service lists an empty `modules`.
  if (!terraform.baseUrl || !terraform.org) {
    const missing = [
      !terraform.baseUrl ? "TERRAFORM_BASE_URL" : null,
      !terraform.org ? "TERRAFORM_ORG" : null,
    ].filter(Boolean);
    log.warn(
      { spineServices: spine.length, missing },
      `terraform channel not configured (${missing.join(", ")} unset) — 0 modules mapped across ${spine.length} service(s)`,
    );
    return spine.map(({ identity, domain }) => ({ identity, domain, modules: [] }));
  }

  // Summary line for a "0 modules" investigation: spine size, how many services the
  // module map matched, how many module addresses were bound. No fetch is issued
  // here — the READMEs behind these addresses load lazily per-service on detail.
  const mapKeys = Object.keys(terraform.moduleMap).length;
  const matchedServices = spine.filter(
    ({ identity }) => (terraform.moduleMap[identity.key] ?? []).length > 0,
  ).length;
  const moduleCount = spine.reduce(
    (n, { identity }) => n + (terraform.moduleMap[identity.key] ?? []).length,
    0,
  );
  log.info(
    { spineServices: spine.length, mapKeys, matchedServices, modules: moduleCount },
    `service discovery (list-only): ${moduleCount} module address(es) across ${matchedServices}/${spine.length} mapped service(s) — READMEs fetched lazily on detail`,
  );

  return spine.map(({ identity, domain }) => {
    const modules = (terraform.moduleMap[identity.key] ?? []).map(
      (name): DiscoveredModule => ({
        sourceId: `${name}-module-readme`,
        name,
        address: `${terraform.org}/${name}/${identity.provider}`,
        headings: [],
      }),
    );
    return { identity, domain, modules };
  });
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
