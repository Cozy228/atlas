/**
 * `deriveGraph` (Step 2, I1) — the pure function that turns the current per-root
 * snapshots into a versioned, content-hashed graph. This is the substrate: the
 * registry and resource records become PROJECTIONS of it (Batch 2), their
 * external shapes byte-stable. Every request pins ONE version at entry, so no
 * handler reads two versions mid-transition (no torn reads across roots).
 *
 * Closed vocabulary (grounded in the three landed sources — see `@atlas/schema`):
 *   nodes  service | landingZone | module | guardrail
 *   edges  available-in (service→LZ) | uses-module (service→module)
 *          | governed-by (service→guardrail)
 *
 * Determinism: nodes and edges are emitted in a stable sort order so the same
 * snapshots always hash to the same `version` (the D2 golden-version guarantee).
 */
import type { GraphEdge, GraphNode, GraphVersion } from "@atlas/schema";
import type { RootSnapshot } from "./graphTypes";
import { contentHash } from "./contentHash";

export function deriveGraph(snapshots: RootSnapshot[]): GraphVersion {
  // Authoritative service names come from the availability spine; terraform /
  // security only ADD edges (and fall back to the slug as a name if a service is
  // referenced there but not in availability — honest, never fabricated).
  const serviceNames = new Map<string, string>();
  const serviceSlugs = new Set<string>();
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  const putNode = (node: GraphNode) => nodes.set(`${node.kind}:${node.id}`, node);

  for (const snapshot of snapshots) {
    const { parse } = snapshot;
    if (parse.kind === "availability") {
      for (const service of parse.services) {
        serviceNames.set(service.slug, service.name);
        serviceSlugs.add(service.slug);
      }
    } else if (parse.kind === "terraform") {
      for (const module of parse.modules) {
        serviceSlugs.add(module.serviceSlug);
      }
    } else {
      for (const link of parse.governedBy ?? []) {
        serviceSlugs.add(link.serviceSlug);
      }
    }
  }

  for (const snapshot of snapshots) {
    const { parse, rootId, resolvedAt } = snapshot;
    if (parse.kind === "availability") {
      putNode({ kind: "landingZone", id: parse.landingZoneId, name: parse.landingZoneName });
      for (const service of parse.services) {
        edges.push({
          type: "available-in",
          from: service.slug,
          to: parse.landingZoneId,
          rootId,
          resolvedAt,
        });
      }
    } else if (parse.kind === "terraform") {
      for (const module of parse.modules) {
        putNode({ kind: "module", id: module.address, name: module.name });
        edges.push({
          type: "uses-module",
          from: module.serviceSlug,
          to: module.address,
          rootId,
          resolvedAt,
          ...(module.version ? { version: module.version } : {}),
        });
      }
    } else {
      for (const guardrail of parse.guardrails) {
        putNode({ kind: "guardrail", id: guardrail.slug, name: guardrail.name });
      }
      for (const link of parse.governedBy ?? []) {
        edges.push({
          type: "governed-by",
          from: link.serviceSlug,
          to: link.guardrailSlug,
          rootId,
          resolvedAt,
        });
      }
    }
  }

  // Service nodes from the union of every root that names a service.
  for (const slug of serviceSlugs) {
    putNode({ kind: "service", id: slug, name: serviceNames.get(slug) ?? slug });
  }

  // Canonical order ⇒ order-insensitive content hash (the D2 golden-version
  // guarantee): identical snapshots in any order hash to one version.
  const sortedNodes = [...nodes.values()].sort(byKey((n) => `${n.kind}:${n.id}`));
  const sortedEdges = [...edges].sort(byKey((e) => `${e.type} ${e.from}->${e.to}`));

  // Version is the structure's content hash; per-root freshness is read-time
  // (its `stale` flag is recomputed against `now`), so it never enters the hash.
  const version = contentHash({ nodes: sortedNodes, edges: sortedEdges });
  const perRootFreshness = snapshots.map((snapshot) => ({
    rootId: snapshot.rootId,
    resolvedAt: snapshot.resolvedAt,
    stale: false,
  }));

  return { version, nodes: sortedNodes, edges: sortedEdges, perRootFreshness };
}

function byKey<T>(key: (value: T) => string): (a: T, b: T) => number {
  return (a, b) => {
    const ka = key(a);
    const kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
}
