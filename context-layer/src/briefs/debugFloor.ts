/**
 * The debug brief FLOOR (Step 7, M7) — the debug moment (deferred from Step 4)
 * assembles the target capability's troubleshooting sections as CITED Evidence
 * PLUS the location index's pointers as the operational floor: content is the bar,
 * locations are the floor (P18). Free-text error interpretation is NEVER done
 * server-side (P12/P15 — the consuming agent's job); `explain_error(app, error?)`'s
 * first version routes to THIS floor (same code path discipline as the other
 * moment tools — a thin wrap over the brief handler, never a second assembly).
 *
 * A block's `evidence[]` carries the cited troubleshooting sections; its
 * `pointers[]` carries the location index (uncited existence, ADR-0003). This
 * REPLACES Step 4's honest not-yet-available `debug` template.
 *
 * STEP 7 BATCH 0 STUB: body lands in Batch 5 (D8).
 */
import type { Brief } from "@atlas/schema";
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";

export type DebugFloorInput = {
  ctx: GovernedResolutionContext;
  /** The target capability (service slug) whose troubleshooting sections + live
   *  locations the floor assembles. */
  service?: string;
};

export async function assembleDebugFloor(_input: DebugFloorInput): Promise<Brief> {
  throw new Error("unimplemented (Step 7 Batch 5)");
}
