import type { AppsRepository } from "./appsRepository";

/**
 * Select the apps repository by environment (Step 3, mid-level §2):
 *
 *   - `APPS_TABLE` set                          → `DynamoAppsRepository` (durable)
 *   - absent + `NODE_ENV === "production"`      → THROW at construction. Durable
 *     consumer state must never silently land in memory; the error names
 *     `APPS_TABLE` so the misconfiguration is diagnosable from the log alone.
 *     (The feedback factory's silent in-memory fallback is the noted-not-fixed
 *     anti-precedent — apps do better, feedback stays surgical.)
 *   - absent otherwise                          → `InMemoryAppsRepository`
 *     (dev/test posture; the `DEV_MOCKS` seam is unchanged).
 *
 * STEP 3 BATCH 0 STUB: bodies land in Batch 1.
 */
export function createAppsRepository(_env: Record<string, string | undefined>): AppsRepository {
  throw new Error("unimplemented (Step 3 Batch 1) — repository selection lands here");
}

/**
 * The process-shared apps store: ONE instance per process, memoized like
 * `sharedCache` (module scope, first-env wins). The routes (write path) and the
 * default `AppDirectoryPort` adapter (read path, Batch 2) must both resolve
 * THIS instance, so a registration is immediately visible to by-reference
 * scope resolution — and so the D5 acceptance spy can prove a by-value read
 * never writes (M11).
 *
 * STEP 3 BATCH 0 STUB: body lands in Batch 1.
 */
export function sharedAppsRepository(_env: Record<string, string | undefined>): AppsRepository {
  throw new Error("unimplemented (Step 3 Batch 1)");
}
