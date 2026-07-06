import type {
  ApiErrorResponse,
  LocationListResponse,
  LocationRegistrationResponse,
} from "@atlas/schema";
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import type { ApiResponse } from "./routeTypes";

/**
 * Self-service registration routes (Step 7, mid-level §3; locked decisions 6, 8)
 * — the ONLY writers of the locations store (M11: no upsert-on-read). Governed +
 * scoped via `ctx`; the owning APP is `ctx.scope.appId`. Frozen contract for
 * Batch 1:
 *
 *   GET    /api/locations?appId=   → 200 `LocationListResponse` (the APP's pointers)
 *   POST   /api/locations?appId=   → 201 `LocationRegistrationResponse` (server id +
 *                                     `discoveredFrom: "registration"`); body is
 *                                     EXACTLY `{ system, kind, url }` — a token /
 *                                     any unknown field is 400 `invalid_request`
 *                                     (no secret store, ever).
 *   DELETE /api/locations/{id}     → 200 `LocationRegistrationResponse` (the removed
 *                                     record) | 404
 *
 * - Wire-up: Batch 1 adds these to `handleHttpRequest` (the one governed router)
 *   at `/locations` + `/locations/{id}`, mirroring `/apps`.
 * - A registration with no `ctx.scope.appId` is a 400 (a location belongs to an APP).
 * - Every mutation logs through `logger("locations")` at `info` (M3: identity-free
 *   but never silent).
 * - Store access goes through `sharedLocationsRepository(env)` so the write path
 *   and the status/index read path share ONE instance.
 *
 * STEP 7 BATCH 0 STUBS: bodies land in Batch 1.
 */
export async function handleLocationsListRequest(
  _ctx: GovernedResolutionContext,
): Promise<ApiResponse<ApiErrorResponse | LocationListResponse>> {
  throw new Error("unimplemented (Step 7 Batch 1)");
}

export async function handleLocationRegistrationRequest(
  _ctx: GovernedResolutionContext,
  _input: unknown,
): Promise<ApiResponse<ApiErrorResponse | LocationRegistrationResponse>> {
  throw new Error("unimplemented (Step 7 Batch 1)");
}

export async function handleLocationDeleteRequest(
  _ctx: GovernedResolutionContext,
  _id: string,
): Promise<ApiResponse<ApiErrorResponse | LocationRegistrationResponse>> {
  throw new Error("unimplemented (Step 7 Batch 1)");
}
