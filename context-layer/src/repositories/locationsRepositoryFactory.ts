import { DynamoLocationsRepository } from "./dynamoLocationsRepository";
import { InMemoryLocationsRepository, type LocationsRepository } from "./locationsRepository";

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
 */
export function createLocationsRepository(
  env: Record<string, string | undefined>,
): LocationsRepository {
  const tableName = env.LOCATIONS_TABLE;
  if (tableName) {
    return new DynamoLocationsRepository({ tableName });
  }
  if (env.NODE_ENV === "production") {
    throw new Error(
      "LOCATIONS_TABLE is not configured in production; durable consumer state (registered " +
        "locations) must not silently land in memory. Set LOCATIONS_TABLE to the provisioned " +
        "DynamoDB table.",
    );
  }
  return new InMemoryLocationsRepository();
}

/**
 * The process-shared locations store: ONE instance per process, memoized like
 * `sharedAppsRepository` (module scope, first-env wins). The registration routes
 * (write path) and the status board / location index (read path) both resolve
 * THIS instance, so a registration is immediately visible to a status read — and
 * so the D7 acceptance spy can prove a status read never writes a value (M11).
 */
let sharedRepository: LocationsRepository | undefined;

export function sharedLocationsRepository(
  env: Record<string, string | undefined>,
): LocationsRepository {
  return (sharedRepository ??= createLocationsRepository(env));
}
