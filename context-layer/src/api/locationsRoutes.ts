import {
  LocationRecordSchema,
  LocationRegistrationRequestSchema,
  type ApiErrorResponse,
  type LocationListResponse,
  type LocationRegistrationResponse,
} from "@atlas/schema";
import { logger } from "../observability/logging";
import { sharedLocationsRepository } from "../repositories/locationsRepositoryFactory";
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

/**
 * Self-service registration routes (Step 7, mid-level §3; locked decisions 6, 8)
 * — the ONLY writers of the locations store (M11: no upsert-on-read). Governed +
 * scoped via `ctx`; the owning APP is `ctx.scope.appId`, never the body. Routes:
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
 * A registration/listing with no `ctx.scope.appId` is a 400 (a location belongs
 * to an APP). Every mutation logs through `logger("locations")` at `info` (M3:
 * identity-free but never silent). Store access goes through
 * `sharedLocationsRepository(env)` so the write path and the status/index read
 * path share ONE instance.
 */
const log = logger("locations");

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}

/** Monotonic per-process suffix so two registrations in the same millisecond
 *  still get distinct ids (Date.now alone can collide under a tight loop). */
let idCounter = 0;
function generateLocationId(): string {
  return `loc-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;
}

export async function handleLocationsListRequest(
  ctx: GovernedResolutionContext,
): Promise<ApiResponse<ApiErrorResponse | LocationListResponse>> {
  const appId = ctx.scope?.appId;
  if (!appId) {
    return errorResponse(
      400,
      "invalid_request",
      "Listing registered locations requires an APP scope (?appId=).",
    );
  }
  const repository = sharedLocationsRepository(readProcessEnv());
  return { status: 200, body: { locations: await repository.listByApp(appId) } };
}

export async function handleLocationRegistrationRequest(
  ctx: GovernedResolutionContext,
  input: unknown,
): Promise<ApiResponse<ApiErrorResponse | LocationRegistrationResponse>> {
  const appId = ctx.scope?.appId;
  if (!appId) {
    return errorResponse(
      400,
      "invalid_request",
      "A location must be registered to an APP scope (?appId=).",
    );
  }

  const parsed = LocationRegistrationRequestSchema.safeParse(input);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "Location registration request is invalid.");
  }

  const record = LocationRecordSchema.parse({
    id: generateLocationId(),
    // The owning APP comes from the vetted scope, never the request body (M3).
    appId,
    system: parsed.data.system,
    kind: parsed.data.kind,
    url: parsed.data.url,
    // Self-service registrations always carry this provenance label.
    discoveredFrom: "registration",
    registeredAt: new Date().toISOString(),
  });

  const stored = await sharedLocationsRepository(readProcessEnv()).put(record);
  log.info(
    { locationId: stored.id, appId: stored.appId, system: stored.system },
    `location registered: ${stored.id}`,
  );
  return { status: 201, body: { location: stored, warnings: [] } };
}

export async function handleLocationDeleteRequest(
  _ctx: GovernedResolutionContext,
  id: string,
): Promise<ApiResponse<ApiErrorResponse | LocationRegistrationResponse>> {
  const repository = sharedLocationsRepository(readProcessEnv());
  const existing = await repository.getById(id);
  if (!existing) {
    // No `location_not_found` code exists in the frozen `apiErrorCodes` set
    // (schema.test.ts pins it); a delete of an unknown id is reported as an
    // invalid request at 404. See implementation-notes Batch 1 (Deviations).
    return errorResponse(404, "invalid_request", `Location '${id}' was not found.`);
  }
  await repository.delete(id);
  log.info({ locationId: id, appId: existing.appId }, `location deleted: ${id}`);
  return { status: 200, body: { location: existing, warnings: [] } };
}
