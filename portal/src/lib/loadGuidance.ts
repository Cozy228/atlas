/**
 * Guidance loader — pure, server/node-safe (no react-start). MULTI-SOURCE:
 * guidance journeys are merged from
 *   1. the GUIDANCE store (`GUIDANCE_URL`, a JSON array of manifests) — the
 *      original path, today serving the non-onboarding journeys (and a seam for
 *      a future source, e.g. fetched from GitHub), and
 *   2. Confluence-authored pages (`loadConfluenceGuidance`) — today the
 *      onboarding journey, parsed from its page's storage HTML.
 * Both are validated against `@atlas/schema`'s `GuidanceSchema`; this maps the
 * snake_case manifest to the camelCase shape the portal lib consumes. A
 * Confluence-authored journey takes precedence over the store on id collision.
 *
 * Kept free of `@tanstack/react-start` so cross-package consumers (e.g.
 * @atlas/acceptance) can load guidance through the package barrel without pulling
 * the server-fn runtime; the `fetchGuidance` server fn in
 * `../api/server/guidance` wraps this.
 */
import { loadConfluenceGuidance } from "@atlas/context-layer";
import { GuidanceSchema, type Guidance as GuidanceManifest } from "@atlas/schema";
import type { Guidance } from "./guidance";

// Display/order contract: keeps the guidance list order stable regardless of the
// source's return order. Any journey not listed is appended alphabetically so a
// new entry is never silently dropped.
const ORDER = ["new-app-onboarding"];

/** Map a validated snake_case manifest to the portal's camelCase Guidance. */
function toGuidance(raw: GuidanceManifest): Guidance {
  return {
    id: raw.id,
    title: raw.title,
    scenario: raw.scenario,
    family: raw.family,
    objective: raw.objective,
    destination: raw.destination,
    owner: raw.owner,
    status: raw.status,
    version: raw.version,
    lastReviewed: raw.last_reviewed,
    // step/task fields already match the lib type (validated above).
    steps: raw.steps as Guidance["steps"],
    ...(raw.applies_to
      ? {
          appliesTo: {
            ...(raw.applies_to.services ? { services: raw.applies_to.services } : {}),
            ...(raw.applies_to.landing_zones ? { landingZones: raw.applies_to.landing_zones } : {}),
            ...(raw.applies_to.security_policies
              ? { securityPolicies: raw.applies_to.security_policies }
              : {}),
          },
        }
      : {}),
    ...(raw.sources ? { sources: raw.sources } : {}),
  };
}

function guidanceUrl(): string | undefined {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env?.GUIDANCE_URL;
}

/**
 * Fetch + validate the guidance-store manifests. Honest-gap: with no
 * `GUIDANCE_URL` configured (or an unavailable store), returns `[]`. A manifest
 * that fails validation is skipped (never poisons the whole list).
 */
async function loadStoreGuidance(): Promise<GuidanceManifest[]> {
  const url = guidanceUrl();
  if (!url) {
    return [];
  }
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    return [];
  }
  const manifests = (await response.json()) as unknown[];
  const valid: GuidanceManifest[] = [];
  for (const entry of manifests) {
    const parsed = GuidanceSchema.safeParse(entry);
    if (parsed.success) {
      valid.push(parsed.data);
    }
  }
  return valid;
}

/**
 * Merge every guidance journey across sources, in the display-order contract.
 * Honest-gap: an unconfigured source contributes nothing rather than a fabricated
 * fixture. Confluence-authored journeys override the store on id collision.
 */
export async function loadGuidance(): Promise<Guidance[]> {
  const [storeManifests, confluenceManifests] = await Promise.all([
    loadStoreGuidance(),
    loadConfluenceGuidance(),
  ]);
  const byId = new Map<string, Guidance>();
  for (const manifest of storeManifests) {
    byId.set(manifest.id, toGuidance(manifest));
  }
  for (const manifest of confluenceManifests) {
    byId.set(manifest.id, toGuidance(manifest));
  }
  const ordered = ORDER.filter((id) => byId.has(id));
  const extras = [...byId.keys()].filter((id) => !ORDER.includes(id)).sort();
  return [...ordered, ...extras].map((id) => byId.get(id)!);
}
