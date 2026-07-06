/**
 * Discovery projection (Step-2 tail, D3 projection inversion) — reconstructs the
 * `DiscoveredService[]` / `DiscoveredGuardrail[]` that `deriveRegistry` /
 * `deriveResources` consume FROM the per-root snapshots, so the composition read
 * path is a projection of the ONE snapshot substrate instead of a second,
 * independent in-process discovery memo. The registry/resource external shapes
 * stay byte-stable (the transport guard proves it).
 *
 * The snapshots hold the same list-only descriptive facts discovery produced
 * (availability slug/name/domain, terraform module addresses, guardrail pageIds),
 * so the reconstruction is exact:
 *   - a service identity is re-derived from its `{provider}/{id}` slug + name via
 *     the same `normalizeServiceIdentity` discovery used;
 *   - modules regain their synthetic `sourceId` (`${name}-module-readme`) and the
 *     empty `headings` list-only discovery carried (READMEs enrich lazily on read);
 *   - guardrails carry the `pageId` the security parse now snapshots.
 * Ordering matches discovery (availability roots in landing-zone order, services
 * in grid order, first-seen wins) so the derived catalog stays byte-stable.
 */
import type { ServiceIdentity } from "@atlas/schema";
import { normalizeServiceIdentity } from "../services/serviceIdentityNormalizer";
import type { RootSnapshot } from "../graph/graphTypes";
import type { DiscoveredGuardrail } from "./discoverGuardrails";
import type { DiscoveredService } from "./discoverSources";

/** Re-derive a service identity from its snapshot `{provider}/{id}` slug + name.
 *  The slug is exactly `normalizeServiceIdentity`'s `key`, so this reproduces the
 *  identity discovery formed from the same spine tuple. */
function identityFromSlug(slug: string, name: string): ServiceIdentity {
  const sep = slug.indexOf("/");
  const provider = sep >= 0 ? slug.slice(0, sep) : "";
  const id = sep >= 0 ? slug.slice(sep + 1) : slug;
  return normalizeServiceIdentity({ provider, id, name });
}

export function reconstructDiscovery(snapshots: RootSnapshot[]): {
  services: DiscoveredService[];
  guardrails: DiscoveredGuardrail[];
} {
  // Services from the availability roots, deduped by identity key (first-seen),
  // preserving landing-zone × grid order for a byte-stable catalog.
  const byKey = new Map<string, DiscoveredService>();
  const order: string[] = [];
  for (const snapshot of snapshots) {
    if (snapshot.parse.kind !== "availability") {
      continue;
    }
    for (const service of snapshot.parse.services) {
      const identity = identityFromSlug(service.slug, service.name);
      if (!byKey.has(identity.key)) {
        byKey.set(identity.key, { identity, domain: service.domain, modules: [] });
        order.push(identity.key);
      }
    }
  }

  // Terraform modules attach to their service by `serviceSlug` (== identity key),
  // in parse order. The synthetic `sourceId` + empty `headings` mirror list-only
  // discovery (the README enriches lazily on a detail read).
  for (const snapshot of snapshots) {
    if (snapshot.parse.kind !== "terraform") {
      continue;
    }
    for (const module of snapshot.parse.modules) {
      const service = byKey.get(module.serviceSlug);
      if (!service) {
        // A module whose service is not in any availability root — honest gap,
        // never fabricated (discovery only ever binds modules to spine services).
        continue;
      }
      service.modules.push({
        sourceId: `${module.name}-module-readme`,
        name: module.name,
        address: module.address,
        headings: [],
        ...(module.version ? { version: module.version } : {}),
      });
    }
  }

  const services = order.map((key) => byKey.get(key) as DiscoveredService);

  // Guardrails from the security root(s), in parse order.
  const guardrails: DiscoveredGuardrail[] = [];
  for (const snapshot of snapshots) {
    if (snapshot.parse.kind !== "security") {
      continue;
    }
    for (const guardrail of snapshot.parse.guardrails) {
      guardrails.push({
        slug: guardrail.slug,
        name: guardrail.name,
        pageId: guardrail.pageId ?? "",
        headings: [],
      });
    }
  }

  return { services, guardrails };
}
