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
 * STEP 7 BATCH 0 STUB: body lands in Batch 2 (D2). Pure over its inputs (graph +
 * registrations + scope) — no I/O, like the brief templates.
 */
import type { GraphVersion, LocationRecord, OperationalLocation } from "@atlas/schema";
import type { BriefScope } from "../briefs/briefTypes";

export type LocationIndexInput = {
  graph: GraphVersion;
  registrations: LocationRecord[];
  scope: BriefScope;
};

export function deriveLocationIndex(_input: LocationIndexInput): OperationalLocation[] {
  throw new Error("unimplemented (Step 7 Batch 2)");
}
