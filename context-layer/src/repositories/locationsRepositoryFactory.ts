import type { LocationsRepository } from "./locationsRepository";

/**
 * Select the locations repository by environment (Step 7, mid-level §2; mirrors
 * `createAppsRepository`):
 *
 *   - `LOCATIONS_TABLE` set                     → `DynamoLocationsRepository` (durable)
 *   - absent + `NODE_ENV === "production"`      → THROW at construction. Durable
 *     consumer state must never silently land in memory; the error names
 *     `LOCATIONS_TABLE` so the misconfiguration is diagnosable from the log alone.
 *   - absent otherwise                          → `InMemoryLocationsRepository`
 *     (dev/test posture; the `DEV_MOCKS` seam is unchanged).
 *
 * STEP 7 BATCH 0 STUB: bodies land in Batch 1.
 */
export function createLocationsRepository(
  _env: Record<string, string | undefined>,
): LocationsRepository {
  throw new Error("unimplemented (Step 7 Batch 1) — repository selection lands here");
}

/**
 * The process-shared locations store: ONE instance per process, memoized like
 * `sharedAppsRepository` (module scope, first-env wins). The registration routes
 * (write path) and the status board / location index (read path) both resolve
 * THIS instance, so a registration is immediately visible to a status read — and
 * so the D7 acceptance spy can prove a status read never writes a value (M11).
 *
 * STEP 7 BATCH 0 STUB: body lands in Batch 1.
 */
export function sharedLocationsRepository(
  _env: Record<string, string | undefined>,
): LocationsRepository {
  throw new Error("unimplemented (Step 7 Batch 1)");
}
