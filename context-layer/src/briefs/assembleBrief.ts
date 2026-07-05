/**
 * The brief executor + assembler (Step 4, I4 + ADR-0014 §2) — the ONLY I/O in
 * the assembly path. `assembleBrief` takes a pure `BriefPlan` and the governed
 * context, resolves every `BlockRequest`'s sections through the existing content
 * path with BOUNDED CONCURRENCY (ADR-0014 §2 aggregator; the per-request
 * `pageCache`; the threaded `GovernedResolutionContext`, I2), and returns the one
 * serialized `Brief` (I3).
 *
 * Honest-empty is mandatory (ADR-0013 §4, locked decision 3): missing data ⇒ an
 * `unresolved` block + the correct warning code (NEVER an absent block); a failed
 * fetch ⇒ a `partial` block + a warning (NEVER silent truncation). Absence of
 * data is not a negative fact.
 *
 * NO brief-level cache (M4): the content cache underneath (`withCache`, wired
 * into `ctx.fetch` by the gate) is the only cache — one clock (ADR-0013 §6). A
 * re-assembly re-runs the executor and re-reads the content cache; it never hands
 * back a memoized `Brief`.
 *
 * Batch-0: signature only (throws). Batch 1 lands the executor + honest-empty
 * glue → D3, D8 green.
 */
import type { Brief } from "@atlas/schema";
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import type { BriefPlan } from "./briefTypes";
import { unimplemented } from "./unimplemented";

export async function assembleBrief(
  _plan: BriefPlan,
  _ctx: GovernedResolutionContext,
): Promise<Brief> {
  return unimplemented("assembleBrief");
}
