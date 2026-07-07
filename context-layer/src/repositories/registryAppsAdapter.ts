import type { AppRecord } from "@atlas/schema";

import type { IdentityClaims } from "../identity/claims";
import type { AppDirectoryPort } from "../resolvers/createResolutionContext";

/**
 * MOCK `registryAppsAdapter` (WS2/WS7, public-safe boundary ADR-0004). It plays the role
 * a real Entra-backed app registry plays in production — so its records carry BOTH
 * `origin: "registry"` (content provenance, axis 3 — the mock IS the registry supplying the
 * content, R8) AND `membershipSource: "entra"` (membership, axis 2). Decision 9's rule
 * "only a real registry flips `origin`" constrains PRODUCTION composition, not this mock.
 *
 * The real Entra / OBO / Azure Resource Graph adapter is company-side, env-configured,
 * behind the same {@link AppDirectoryPort}. This mock is NEVER selected under a production
 * env configuration: it is injected only by tests and by the local mock-Entra dev posture
 * (Seam B, behind `DEV_MOCKS`). The factory default stays `selfDeclaredAppsAdapter` (R5).
 *
 * Mapping (fictional, public-safe): an Entra **app-role value** grants membership to one
 * fictional APP. `resolveMembership(claims)` maps the caller's roles to the APP set they
 * are VERIFIED members of (axis 2); `lookup(appId)` resolves the same records' landing-zone
 * sets for by-reference scope selection (axis 1).
 */

const NOW = "2026-07-07T00:00:00.000Z";

function mockRegistryApp(id: string, name: string, landingZoneIds: string[]): AppRecord {
  return {
    id,
    name,
    landingZoneIds,
    serviceSlugs: [],
    // Axis 3: a real registry supplied the content ⇒ `registry` (in the mock only, R8).
    origin: "registry",
    // Axis 2: membership verified by an Entra claim.
    membershipSource: "entra",
    declaredAt: NOW,
    updatedAt: NOW,
  };
}

/** Fictional app-role value → the fictional APP it grants membership to. */
const MOCK_APP_ROLE_MAP: ReadonlyMap<string, AppRecord> = new Map([
  ["app.orion.member", mockRegistryApp("registry-app-orion", "Orion", ["awsf", "azrf"])],
  ["app.lyra.member", mockRegistryApp("registry-app-lyra", "Lyra", ["awsf"])],
]);

/** All records the mock registry knows about (for `lookup` over the same fictional set). */
const MOCK_APPS_BY_ID: ReadonlyMap<string, AppRecord> = new Map(
  [...MOCK_APP_ROLE_MAP.values()].map((app) => [app.id, app]),
);

/**
 * Build the mock registry adapter. `roleMap` is overridable so a test can pin its own
 * fictional role→APP mapping; the default is the public-safe fixture above.
 */
export function createMockRegistryAppsAdapter(
  roleMap: ReadonlyMap<string, AppRecord> = MOCK_APP_ROLE_MAP,
): AppDirectoryPort {
  const byId = new Map([...roleMap.values()].map((app) => [app.id, app]));
  return {
    async lookup(appId: string) {
      const app = byId.get(appId);
      return app ? { landingZoneIds: app.landingZoneIds } : null;
    },
    async resolveMembership(claims: IdentityClaims): Promise<AppRecord[]> {
      const verified = new Map<string, AppRecord>();
      for (const role of claims.roles) {
        const app = roleMap.get(role);
        if (app) {
          verified.set(app.id, app);
        }
      }
      return [...verified.values()];
    },
  };
}

/** The default public-safe mock registry adapter instance. */
export const mockRegistryAppsAdapter: AppDirectoryPort = createMockRegistryAppsAdapter();

/** Exposed so the portal Seam-B mock-identity path can list the same fictional records. */
export const MOCK_REGISTRY_APPS: readonly AppRecord[] = [...MOCK_APPS_BY_ID.values()];
