/**
 * The location index (Step 7, M7) — "where does this APP's stuff live", the debug
 * brief's FLOOR. Derives `OperationalLocation` POINTERS (existence + provenance)
 * from TWO sources, scoped to the situation:
 *
 *   - the graph's edges (Step 2): a service's discovered bindings (e.g. a
 *     `uses-module` edge → a TFE workspace pointer) — same single discovery path,
 *     never a second parse;
 *   - the APP's registered locations (consumer state) — the self-service pointers.
 *
 * A pointer's *existence* carries provenance (`discoveredFrom`); any *value*
 * fetched through it is operational status handled by the status board — the
 * index itself is value-free (ADR-0003).
 *
 * Pure over its inputs (graph + registrations + scope) — no I/O, like the brief
 * templates.
 */
import type { GraphVersion, LocationRecord, OperationalLocation } from "@atlas/schema";
import type { BriefScope } from "../briefs/briefTypes";

export type LocationIndexInput = {
  graph: GraphVersion;
  registrations: LocationRecord[];
  scope: BriefScope;
};

/**
 * A graph-derived pointer's provenance string: `graph:<rootId>:<edgeType>` — it
 * names the source root that witnessed the binding plus the edge kind that
 * yielded the pointer (e.g. `graph:terraform:uses-module`). It carries the graph
 * root id verbatim (so it `includes(TERRAFORM_ROOT_ID)`) and is distinct from a
 * registered pointer's `discoveredFrom`, which is exactly `"registration"`.
 */
function graphProvenance(rootId: string, edgeType: string): string {
  return `graph:${rootId}:${edgeType}`;
}

/**
 * Strip a stored registration down to a value-free `OperationalLocation` pointer:
 * drop the consumer-state fields (`appId`, `registeredAt`) so only the five
 * pointer keys survive. No `value` key ever rides an index entry (ADR-0003).
 */
function toPointer(record: LocationRecord): OperationalLocation {
  return {
    id: record.id,
    system: record.system,
    kind: record.kind,
    url: record.url,
    discoveredFrom: record.discoveredFrom,
  };
}

export function deriveLocationIndex(input: LocationIndexInput): OperationalLocation[] {
  const { graph, registrations, scope } = input;
  const scopedServices = new Set(scope.serviceSlugs);
  const pointers: OperationalLocation[] = [];

  // 1) The APP's registered locations (consumer state), scoped to the owning APP.
  //    Without an `appId` there is no APP to attribute a registration to, so none
  //    are included (mirrors how routes read the owning APP from `ctx.scope.appId`).
  if (scope.appId !== undefined) {
    for (const record of registrations) {
      if (record.appId !== scope.appId) continue;
      pointers.push(toPointer(record));
    }
  }

  // 2) Graph-derived pointers: a service's `uses-module` binding → a TFE workspace
  //    pointer (the M12 exemplar system). We read the edges `deriveGraph` already
  //    produced — the ONE discovery path, never a second parse — and follow the
  //    scope's services, the same shape as the brief templates. The `url` is
  //    honestly derived from the module address the edge carries (never
  //    fabricated); provenance carries the terraform graph root.
  for (const edge of graph.edges) {
    if (edge.type !== "uses-module") continue;
    if (!scopedServices.has(edge.from)) continue;
    pointers.push({
      id: `workspace:${edge.from}:${edge.to}`,
      system: "tfe",
      kind: "workspace",
      url: `https://${edge.to}`,
      discoveredFrom: graphProvenance(edge.rootId, edge.type),
    });
  }

  return pointers;
}
