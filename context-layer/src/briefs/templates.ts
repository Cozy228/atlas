/**
 * The moment templates (Step 4, I4/M5) — CODE, not a DSL (like `landingZones/`:
 * configuration input, no template engine, no fourth template without a product
 * decision). Each is a PURE function `(graph, scope) → BlockRequest[]`: it names
 * which edges to follow and which section subset per node (both closed sets, M5
 * relevance contracts, no numeric budget), fanning out per-zone over the
 * situation's landing-zone SET (P26). A block delivers the JOIN — it never plans
 * to re-serve content the agent can discover itself from its repo or the source
 * directly (P28).
 *
 * adopt / build plan from `(graph, scope)`; change is threaded the derived feed.
 */
import type { ChangeEvent, GraphVersion, SectionId } from "@atlas/schema";
import type { BlockRequest, BriefScope, BriefTemplate } from "./briefTypes";

/**
 * Adopt (D4): "can I adopt this service here?" — the adopt relevance contract
 * (M5, closed sets, no budget):
 *
 *   - LZ-DEPENDENT (P26): the `availability` section is asked ONCE PER member zone
 *     in the situation's LZ set — the whole point of adopt is "available HERE?",
 *     answered for every candidate zone (honest-empty where a zone has no data,
 *     never an absent block).
 *   - LZ-INDEPENDENT: the service's adoption context — `overview`, `network` (only
 *     when the graph shows the service uses a module — `uses-module`), and
 *     `security` — rendered ONCE (no `landingZoneId`).
 *
 * Every block's subject is the target service (a block delivers the JOIN, never a
 * re-served body the agent can read itself, P28). Pure: `(graph, scope)` only —
 * no I/O, no `now()`.
 */
export const adoptTemplate: BriefTemplate = (graph: GraphVersion, scope: BriefScope) => {
  const requests: BlockRequest[] = [];
  for (const slug of scope.serviceSlugs) {
    const subject = { kind: "service", id: slug };

    // LZ-dependent: availability per member zone (the fan-out follows the LZ set).
    for (const landingZoneId of scope.landingZoneIds) {
      requests.push({ subject, sections: ["availability"], landingZoneId });
    }

    // LZ-independent: the once-rendered adoption context. `network` is only in the
    // closed subset when the graph witnesses a module edge for the service.
    const usesModule = graph.edges.some(
      (edge) => edge.type === "uses-module" && edge.from === slug,
    );
    const sections: SectionId[] = usesModule
      ? ["overview", "network", "security"]
      : ["overview", "security"];
    requests.push({ subject, sections });
  }
  return requests;
};

/**
 * Build (D5): "what is my context?" — the join across the situation's declared
 * services (their modules/policies/guidance), the fan-out following the data (a
 * service with 8 modules shows 8, M5). Batch 3.
 */
export const buildTemplate: BriefTemplate = (graph: GraphVersion, scope: BriefScope) => {
  const requests: BlockRequest[] = [];
  for (const slug of scope.serviceSlugs) {
    const subject = { kind: "service", id: slug };
    // The "my context" join for one declared service. `network`/`examples` are in
    // the closed subset only when the graph witnesses a module edge; the section
    // resolution then fans out one citation per bound module — a service with N
    // modules shows N (M5, no numeric budget), the fan-out following the data.
    const usesModule = graph.edges.some(
      (edge) => edge.type === "uses-module" && edge.from === slug,
    );
    const sections: SectionId[] = usesModule
      ? ["overview", "network", "security", "examples"]
      : ["overview", "security"];
    requests.push({ subject, sections });
  }
  return requests;
};

/**
 * Change (D6): "what changed for me?" — plans a block per relevant recent change
 * to the situation's subjects, each citing its event. To keep the planner PURE
 * (I4/M5 — no I/O, no fetch), the scoped `events` are an INPUT, not a side
 * effect: the executor reads `handleChangesRequest` (the only I/O) and hands the
 * events to this pure function.
 *
 * NOTE (doc reconciliation, flagged for review): mid-level/goal say "the change
 * template reads the Step-2 feed"; purity (locked decision 2) forbids I/O inside
 * a template, so the feed is threaded as an argument rather than fetched here —
 * the read still happens, in the executor. Batch 4.
 */
export function changeTemplate(
  _graph: GraphVersion,
  _scope: BriefScope,
  events: ChangeEvent[],
): BlockRequest[] {
  // One planned block per relevant change, in feed order. The `events` are the
  // planner's substrate (already scope-filtered by the executor's
  // `handleChangesRequest` read); `graph`/`scope` ride the frozen pure signature
  // (I1 pin) but the change moment's truth is the derived feed. `sections` is
  // empty by construction: a change block DELIVERS the announcement, it never
  // re-serves the changed resource's body — the agent follows the feed / resource
  // atom for that (P28). A single-zone event carries its member zone (P26).
  return events.map((event) => ({
    subject: { kind: event.subject.kind, id: event.subject.id },
    sections: [] as SectionId[],
    ...(event.landingZoneIds.length === 1 ? { landingZoneId: event.landingZoneIds[0] } : {}),
  }));
}

/**
 * Dispatch the pure moment templates that plan from `(graph, scope)` alone
 * (adopt / build). `change` is threaded its feed separately (see above) and
 * `debug` is a documented not-yet-available honest response (Step 7, M7), so
 * neither routes through here.
 */
export function templateForMoment(moment: "adopt" | "build"): BriefTemplate {
  return moment === "adopt" ? adoptTemplate : buildTemplate;
}
