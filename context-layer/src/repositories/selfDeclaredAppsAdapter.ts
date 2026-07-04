import type { AppDirectoryPort } from "../resolvers/createResolutionContext";
import type { AppsRepository } from "./appsRepository";

/**
 * `AppDirectoryPort` over the apps repository (Step 3 Batch 2; the name is
 * pre-ratified by `entra-app-scope-implementation-plan.md`): `lookup(appId)`
 * returns the stored record's `landingZoneIds` or `null` when unknown —
 * lookup-only by construction (M11: reads never write).
 *
 * Batch 2 also swaps `createResolutionContext`'s DEFAULT `appDirectory` to
 * this adapter over `sharedAppsRepository(env)` (memoized like `sharedCache`);
 * `nullAppDirectoryAdapter` stays exported for callers/tests that want the
 * empty directory, and the Entra-era `registryAppsAdapter` swap must remain a
 * pure adapter swap — no factory signature change.
 *
 * STEP 3 BATCH 0 STUB: body lands in Batch 2.
 */
export function createSelfDeclaredAppsAdapter(_repository: AppsRepository): AppDirectoryPort {
  throw new Error("unimplemented (Step 3 Batch 2)");
}
