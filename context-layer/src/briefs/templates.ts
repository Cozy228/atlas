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
 * Batch-0: signatures only (throw `unimplemented`). Batch 2 lands adopt, Batch 3
 * build, Batch 4 change.
 */
import type { ChangeEvent, GraphVersion } from "@atlas/schema";
import type { BlockRequest, BriefScope, BriefTemplate } from "./briefTypes";
import { unimplemented } from "./unimplemented";

/**
 * Adopt (D4): "can I adopt this service here?" — follows the adopt edge/section
 * contract and emits per-zone availability + policy blocks for the situation's LZ
 * set, plus the LZ-independent service blocks once (P26). Batch 2.
 */
export const adoptTemplate: BriefTemplate = (_graph: GraphVersion, _scope: BriefScope) => {
  return unimplemented("adoptTemplate");
};

/**
 * Build (D5): "what is my context?" — the join across the situation's declared
 * services (their modules/policies/guidance), the fan-out following the data (a
 * service with 8 modules shows 8, M5). Batch 3.
 */
export const buildTemplate: BriefTemplate = (_graph: GraphVersion, _scope: BriefScope) => {
  return unimplemented("buildTemplate");
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
  _events: ChangeEvent[],
): BlockRequest[] {
  return unimplemented("changeTemplate");
}

/**
 * Dispatch the pure moment templates that plan from `(graph, scope)` alone
 * (adopt / build). `change` is threaded its feed separately (see above) and
 * `debug` is a documented not-yet-available honest response (Step 7, M7), so
 * neither routes through here.
 */
export function templateForMoment(moment: "adopt" | "build"): BriefTemplate {
  return unimplemented(`templateForMoment(${moment})`);
}
