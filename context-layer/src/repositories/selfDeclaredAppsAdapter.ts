import type { AppDirectoryPort } from "../resolvers/createResolutionContext";
import type { AppsRepository } from "./appsRepository";

/**
 * `AppDirectoryPort` over the apps repository (Step 3; the name is pre-ratified
 * by `entra-app-scope-implementation-plan.md`): `lookup(appId)` returns the
 * stored record's `landingZoneIds` or `null` when unknown — lookup-only by
 * construction (M11: reads never write).
 *
 * This becomes `createResolutionContext`'s DEFAULT `appDirectory` (over
 * `sharedAppsRepository(env)`), so by-reference scope resolves through the real
 * store. The Entra-era `registryAppsAdapter` swap must remain a pure adapter
 * swap over the same port — no factory signature change.
 */
export function createSelfDeclaredAppsAdapter(repository: AppsRepository): AppDirectoryPort {
  return {
    async lookup(appId: string) {
      const app = await repository.getById(appId);
      return app ? { landingZoneIds: app.landingZoneIds } : null;
    },
  };
}
