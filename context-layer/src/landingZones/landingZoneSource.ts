import type { LandingZone } from "@atlas/schema";

/**
 * An LZ's resolved availability-source locator (ADR-0017 d.3): enough to fetch +
 * parse the Confluence availability page bound to a landing zone. The second of
 * the two layers kept separate — the topology (`LANDING_ZONES`) is dev=prod,
 * this locator is env-bound (dev→MSW mock page / prod→real space).
 */
export type LandingZoneSource = {
  baseUrl: string;
  token: string;
  email?: string;
  /** The per-LZ availability page identifier (Confluence page id). */
  pageId: string;
};

/**
 * Derive a landing zone's availability-source locator from environment config,
 * mirroring `createReferenceDiscoveryFromEnv` in `composition.ts`: the shared
 * `ATLAS_CONFLUENCE_*` connection plus a per-LZ availability-page var keyed by id
 * (`ATLAS_CONFLUENCE_AVAILABILITY_PAGE_<ID>`, e.g. `..._AWSF`). dev/integration
 * point these at the MSW source-space fixture; prod points them at the real site.
 *
 * Returns `undefined` when the channel is unconfigured for this LZ — an honest
 * absence (the caller renders a data-not-available dead-end, ADR-0006), never a
 * fabricated locator. Nothing consumes this yet; Goal B wires it through
 * `composition.ts` into `confluenceAvailabilityProvider`.
 */
export function resolveLandingZoneSource(
  zone: LandingZone,
  env: Record<string, string | undefined> = readProcessEnv(),
): LandingZoneSource | undefined {
  const baseUrl = env.ATLAS_CONFLUENCE_BASE_URL;
  const token = env.ATLAS_CONFLUENCE_TOKEN;
  const pageId = env[`ATLAS_CONFLUENCE_AVAILABILITY_PAGE_${zone.id.toUpperCase()}`];
  if (!baseUrl || !token || !pageId) {
    return undefined;
  }
  return { baseUrl, token, email: env.ATLAS_CONFLUENCE_EMAIL, pageId };
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
