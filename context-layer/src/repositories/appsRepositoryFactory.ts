import { DynamoAppsRepository } from "./dynamoAppsRepository";
import { InMemoryAppsRepository, type AppsRepository } from "./appsRepository";

/**
 * Select the apps repository by environment (Step 3, mid-level §2):
 *
 *   - `APPS_TABLE` set                     → `DynamoAppsRepository` (durable)
 *   - absent + `NODE_ENV === "production"` → THROW at construction. Durable
 *     consumer state must never silently land in memory; the error names
 *     `APPS_TABLE` so the misconfiguration is diagnosable from the log alone.
 *     (This is where apps do better than the feedback factory's silent
 *     in-memory fallback — the noted-not-fixed anti-precedent.)
 *   - absent otherwise                     → `InMemoryAppsRepository`
 *     (dev/test posture; the `DEV_MOCKS` seam is unchanged).
 */
export function createAppsRepository(env: Record<string, string | undefined>): AppsRepository {
  const tableName = env.APPS_TABLE;
  if (tableName) {
    return new DynamoAppsRepository({ tableName });
  }
  if (env.NODE_ENV === "production") {
    throw new Error(
      "APPS_TABLE is not configured in production; durable consumer state (self-declared APPs) " +
        "must not silently land in memory. Set APPS_TABLE to the provisioned DynamoDB table.",
    );
  }
  return new InMemoryAppsRepository();
}

/**
 * The process-shared apps store: ONE instance per process, memoized like
 * `sharedCache` (module scope, first-env wins). The routes (write path) and the
 * default `AppDirectoryPort` adapter (read path, Batch 2) both resolve THIS
 * instance, so a registration is immediately visible to by-reference scope
 * resolution — and so the D5 acceptance spy can prove a by-value read never
 * writes (M11).
 */
let sharedRepository: AppsRepository | undefined;

export function sharedAppsRepository(env: Record<string, string | undefined>): AppsRepository {
  return (sharedRepository ??= createAppsRepository(env));
}
