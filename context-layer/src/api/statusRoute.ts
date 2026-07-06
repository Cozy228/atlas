import type { ApiErrorResponse, StatusBoardResponse } from "@atlas/schema";
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import type { ApiResponse } from "./routeTypes";

/**
 * The status board route (Step 7, P24; locked decision 8) — governed + scoped via
 * `ctx`, a scope reader like availability/changes. Frozen contract for Batch 5:
 *
 *   GET /api/status?appId=   (fallback landingZones) → 200 `StatusBoardResponse`
 *
 * Filters to the scope's registered locations, live-fetches each value through
 * the owning adapter (threading `ctx.token` for `caller-bearer` adapters), and
 * returns the values READ-ONLY, UNCITED, visually-separable from Evidence
 * (ADR-0003). A fetch failure / `none` authMode / missing adapter degrades to a
 * labeled pointer (locked decision 5). NO durable store, NO history, NO alerting.
 *
 * - Wire-up: Batch 5 adds this to `handleHttpRequest` at `/status`.
 * - The board performs ZERO writes — a status value never reaches any store (D7).
 *
 * STEP 7 BATCH 0 STUB: body lands in Batch 5.
 */
export async function handleStatusRequest(
  _ctx: GovernedResolutionContext,
): Promise<ApiResponse<ApiErrorResponse | StatusBoardResponse>> {
  throw new Error("unimplemented (Step 7 Batch 5)");
}
