/**
 * The differ (Step 2, M6) — a PURE function: two successive graph versions →
 * `ChangeEvent[]` over the closed `EventClass` set. No damping here (that is the
 * transition layer's job, `graph/snapshotTransition.ts`); no I/O; deterministic.
 *
 * Diff rules (grounded in the closed vocabulary):
 *   - service node set diff        → service-added / service-removed
 *   - available-in edge set diff   → available-in-added / available-in-removed
 *   - governed-by edge set diff    → governed-by-added / governed-by-removed
 *   - uses-module edge, same (service,module) present in both, version changed
 *                                  → module-version-changed (from→to)
 *   (a uses-module edge appearing/disappearing emits NOTHING — the only module
 *    delta that is Evidence is a published-version change.)
 *
 * A slug rename surfaces honestly as service-removed + service-added: discovery
 * cannot see intent (M6). Each event carries the subject's landing-zone set
 * (computed from the `to` version's available-in edges) as its scope-filter key.
 */
import {
  type ChangeEvent,
  type GraphEdge,
  type GraphNodeRef,
  type GraphVersion,
} from "@atlas/schema";
import { contentHash } from "../graph/contentHash";

/** Provenance stamped onto every event of one transition (M10 inline derive). */
export type DiffContext = {
  rootId: string;
  derivedAt: string;
};

export function diffGraphVersions(
  from: GraphVersion,
  to: GraphVersion,
  context: DiffContext,
): ChangeEvent[] {
  const events: Omit<
    ChangeEvent,
    "id" | "graphVersionFrom" | "graphVersionTo" | "derivedAt" | "rootId"
  >[] = [];

  const fromServices = serviceIds(from);
  const toServices = serviceIds(to);

  // Service nodes: set diff. LZ set is read from the version that HAS the service.
  for (const slug of toServices) {
    if (!fromServices.has(slug)) {
      events.push({
        class: "service-added",
        subject: serviceRef(slug),
        landingZoneIds: serviceLandingZones(to, slug),
      });
    }
  }
  for (const slug of fromServices) {
    if (!toServices.has(slug)) {
      events.push({
        class: "service-removed",
        subject: serviceRef(slug),
        landingZoneIds: serviceLandingZones(from, slug),
      });
    }
  }

  // available-in edges: set diff. Each event carries exactly its one LZ.
  diffEdgeSet(from, to, "available-in", {
    added: (edge) => ({
      class: "available-in-added",
      subject: serviceRef(edge.from),
      object: { kind: "landingZone", id: edge.to },
      landingZoneIds: [edge.to],
    }),
    removed: (edge) => ({
      class: "available-in-removed",
      subject: serviceRef(edge.from),
      object: { kind: "landingZone", id: edge.to },
      landingZoneIds: [edge.to],
    }),
    push: (event) => events.push(event),
  });

  // governed-by edges: set diff. LZ set is the service's zones in the relevant version.
  diffEdgeSet(from, to, "governed-by", {
    added: (edge) => ({
      class: "governed-by-added",
      subject: serviceRef(edge.from),
      object: { kind: "guardrail", id: edge.to },
      landingZoneIds: serviceLandingZones(to, edge.from),
    }),
    removed: (edge) => ({
      class: "governed-by-removed",
      subject: serviceRef(edge.from),
      object: { kind: "guardrail", id: edge.to },
      landingZoneIds: serviceLandingZones(from, edge.from),
    }),
    push: (event) => events.push(event),
  });

  // uses-module edges: only a VERSION change on a binding present in BOTH is an
  // event (a binding appearing/disappearing emits nothing — closed set).
  const fromModules = edgesByType(from, "uses-module");
  const toModules = edgesByType(to, "uses-module");
  for (const [key, toEdge] of toModules) {
    const fromEdge = fromModules.get(key);
    if (fromEdge && (fromEdge.version ?? "") !== (toEdge.version ?? "")) {
      events.push({
        class: "module-version-changed",
        subject: serviceRef(toEdge.from),
        object: { kind: "module", id: toEdge.to },
        landingZoneIds: serviceLandingZones(to, toEdge.from),
        from: fromEdge.version,
        to: toEdge.version,
      });
    }
  }

  return events.map((event) => ({
    ...event,
    id: changeEventId({
      class: event.class,
      subject: event.subject,
      object: event.object,
      from: event.from,
      to: event.to,
      graphVersionFrom: from.version,
      graphVersionTo: to.version,
    }),
    rootId: context.rootId,
    graphVersionFrom: from.version,
    graphVersionTo: to.version,
    derivedAt: context.derivedAt,
  }));
}

type PartialEvent = Omit<
  ChangeEvent,
  "id" | "graphVersionFrom" | "graphVersionTo" | "derivedAt" | "rootId"
>;

function diffEdgeSet(
  from: GraphVersion,
  to: GraphVersion,
  type: GraphEdge["type"],
  handlers: {
    added: (edge: GraphEdge) => PartialEvent;
    removed: (edge: GraphEdge) => PartialEvent;
    push: (event: PartialEvent) => void;
  },
): void {
  const fromEdges = edgesByType(from, type);
  const toEdges = edgesByType(to, type);
  for (const [key, edge] of toEdges) {
    if (!fromEdges.has(key)) {
      handlers.push(handlers.added(edge));
    }
  }
  for (const [key, edge] of fromEdges) {
    if (!toEdges.has(key)) {
      handlers.push(handlers.removed(edge));
    }
  }
}

function serviceIds(graph: GraphVersion): Set<string> {
  return new Set(graph.nodes.filter((n) => n.kind === "service").map((n) => n.id));
}

function serviceRef(slug: string): GraphNodeRef {
  return { kind: "service", id: slug };
}

function edgesByType(graph: GraphVersion, type: GraphEdge["type"]): Map<string, GraphEdge> {
  const map = new Map<string, GraphEdge>();
  for (const edge of graph.edges) {
    if (edge.type === type) {
      map.set(`${edge.from}->${edge.to}`, edge);
    }
  }
  return map;
}

/** The sorted set of landing zones a service is available in, within a version. */
function serviceLandingZones(graph: GraphVersion, slug: string): string[] {
  return graph.edges
    .filter((edge) => edge.type === "available-in" && edge.from === slug)
    .map((edge) => edge.to)
    .sort();
}

/**
 * The idempotency id (M1): a content hash of the identity-bearing fields of an
 * event, so re-deriving the same transition yields the same id ⇒ a no-op
 * conditional put. Deliberately EXCLUDES `derivedAt` (a wall-clock stamp) so a
 * re-run at a later time still collides. Pure — safe to call from the differ.
 */
export function changeEventId(
  parts: Pick<
    ChangeEvent,
    "class" | "subject" | "object" | "from" | "to" | "graphVersionFrom" | "graphVersionTo"
  >,
): string {
  return contentHash({
    class: parts.class,
    subject: parts.subject,
    object: parts.object,
    from: parts.from,
    to: parts.to,
    graphVersionFrom: parts.graphVersionFrom,
    graphVersionTo: parts.graphVersionTo,
  });
}
