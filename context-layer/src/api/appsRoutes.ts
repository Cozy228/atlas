import type {
  ApiErrorResponse,
  AppListResponse,
  AppMutationResponse,
  AppResponse,
} from "@atlas/schema";
import type { ApiResponse } from "./routeTypes";

/**
 * Consumer-state routes (Step 3, mid-level §3) — the ONLY writers of the apps
 * store (M11: no upsert-on-read anywhere). Frozen contract for Batch 1:
 *
 *   GET   /api/apps        → 200 `AppListResponse`
 *   POST  /api/apps        → 201 `AppMutationResponse` (server-generated id)
 *   GET   /api/apps/{id}   → 200 `AppResponse` | 404 `app_not_found`
 *   PATCH /api/apps/{id}   → 200 `AppMutationResponse` (partial update:
 *                            name / landingZoneIds / serviceSlugs; bumps
 *                            `updatedAt`) | 404 `app_not_found`
 *   (no DELETE in Step 3; the router 404s it like any unknown route)
 *
 * - Wire-up: Batch 1 adds these to `handleHttpRequest` (the one governed
 *   router) at `/apps` + `/apps/{id}`, mirroring `/feedback`.
 * - `origin` is unconditionally `"self-declared"` on both write routes; a
 *   caller-supplied `origin` (or any unknown field) is structural invalidity →
 *   400 `invalid_request` (strict schemas).
 * - Dangling declarations are stored VERBATIM and warned, never dropped:
 *   `serviceSlugs` validate against discovered records (the feedback
 *   target-existence mechanism), `landingZoneIds` against `LANDING_ZONES`;
 *   unknown entries yield `unknown_service` / `unknown_landing_zone` in the
 *   201/200 response's `warnings[]` (locked decision 5).
 * - Every mutation logs through `logger("apps")` at `info` (M3: identity-free
 *   but never silent) — the D2 pino spy pins this exact channel.
 * - Store access goes through `sharedAppsRepository(env)` so the write path
 *   and the Batch-2 default AppDirectory adapter share ONE instance.
 *
 * STEP 3 BATCH 0 STUBS: bodies land in Batch 1.
 */
export async function handleAppsListRequest(): Promise<
  ApiResponse<ApiErrorResponse | AppListResponse>
> {
  throw new Error("unimplemented (Step 3 Batch 1)");
}

export async function handleAppRegistrationRequest(
  _input: unknown,
): Promise<ApiResponse<ApiErrorResponse | AppMutationResponse>> {
  throw new Error("unimplemented (Step 3 Batch 1)");
}

export async function handleAppRequest(
  _id: string,
): Promise<ApiResponse<ApiErrorResponse | AppResponse>> {
  throw new Error("unimplemented (Step 3 Batch 1)");
}

export async function handleAppUpdateRequest(
  _id: string,
  _input: unknown,
): Promise<ApiResponse<ApiErrorResponse | AppMutationResponse>> {
  throw new Error("unimplemented (Step 3 Batch 1)");
}
