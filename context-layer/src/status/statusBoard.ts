/**
 * The status board (Step 7, P24) — AGGREGATION-AT-READ of live operational values
 * for a scope's registered locations. For each location:
 *
 *   resolve the owning system's adapter (M12):
 *     value fetched  → a `LocationStatus` with the uncited `value` + `fetchedAt`;
 *     no adapter / authMode `none` / fetch fails → a labeled pointer
 *       (`value: null` + a `reason`) — the honest floor, never a fabricated value.
 *
 * Hard lines (ADR-0003 + P24):
 *   - a value is uncited operational status — NEVER Evidence, NEVER stored;
 *   - NO durable store, NO history, NO alerting — the board is recomputed every
 *     read (this function performs ZERO writes — the D7 spy proves it);
 *   - value fetch goes ONLY through the adapter's allowlisted base (SSRF closed).
 *
 * Pure-ish: `assembleStatusBoard` takes the already-loaded `registrations` + the
 * injected `adapters` (the test seam) + the read context, and returns the board —
 * it never touches a repository, so no status value can reach any store.
 *
 * STEP 7 BATCH 0 STUB: body lands in Batch 4 (D6/D7).
 */
import type { LocationRecord, Situation, StatusBoardResponse } from "@atlas/schema";
import type { StatusAdapter, StatusAdapterContext } from "../locations/statusAdapter";

export type StatusBoardDeps = {
  /** The scope echo carried on the response. */
  situation: Situation;
  /** The scope's registered locations (already loaded — the board never queries). */
  registrations: LocationRecord[];
  /** Value-capable adapters, keyed by `adapter.system` (the injection seam). A
   *  system with no matching adapter degrades to a labeled pointer. */
  adapters: StatusAdapter[];
  /** The read context each value fetch runs in (fetch + caller token + env). */
  adapterContext: StatusAdapterContext;
};

export async function assembleStatusBoard(_deps: StatusBoardDeps): Promise<StatusBoardResponse> {
  throw new Error("unimplemented (Step 7 Batch 4)");
}
