/**
 * Guidance loader — pure, server/node-safe (no react-start), single live path.
 *
 * Fetches the route-guidance manifests from the guidance store (`GUIDANCE_URL`,
 * MSW-intercepted in dev, a real store in prod), validates each against
 * `@atlas/schema`'s `GuidanceSchema`, and maps the snake_case manifest to the
 * camelCase shape the portal lib consumes. This replaces the file-reading dev
 * adapter (`adapters/dev/loadGuidance`) so guidance loads like every other source
 * (release notes, registry) — over the wire, not off `data/`.
 *
 * Kept free of `@tanstack/react-start` so cross-package consumers (e.g.
 * @atlas/acceptance) can load guidance through the package barrel without pulling
 * the server-fn runtime; the `fetchGuidance` server fn in
 * `../api/server/guidance` wraps this.
 */
import { GuidanceSchema } from "@atlas/schema";
import type { Guidance } from "./guidance";

// Display/order contract: keeps the guidance list order stable regardless of the
// store's return order. Any manifest not listed is appended alphabetically so a
// new entry is never silently dropped.
const ORDER = ["new-app-onboarding", "api-gateway-adoption", "s3-adoption", "textract-adoption"];

/** Map a validated snake_case manifest to the portal's camelCase Guidance. */
function toGuidance(raw: Record<string, unknown>): Guidance {
  const applies = raw.applies_to as
    | { services?: string[]; landing_zones?: string[]; security_policies?: string[] }
    | undefined;
  return {
    id: raw.id as string,
    title: raw.title as string,
    type: raw.type as Guidance["type"],
    scenario: raw.scenario as string,
    family: raw.family as Guidance["family"],
    objective: raw.objective as string,
    destination: raw.destination as Guidance["destination"],
    owner: raw.owner as Guidance["owner"],
    status: raw.status as Guidance["status"],
    version: raw.version as string,
    lastReviewed: raw.last_reviewed as string,
    // step/task/option fields already match the lib type (validated above).
    steps: raw.steps as Guidance["steps"],
    ...(applies
      ? {
          appliesTo: {
            ...(applies.services ? { services: applies.services } : {}),
            ...(applies.landing_zones ? { landingZones: applies.landing_zones } : {}),
            ...(applies.security_policies ? { securityPolicies: applies.security_policies } : {}),
          },
        }
      : {}),
    ...(raw.sources ? { sources: raw.sources as ReadonlyArray<string> } : {}),
  };
}

function guidanceUrl(): string | undefined {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env?.GUIDANCE_URL;
}

/**
 * Fetch + validate every guidance manifest, in the display-order contract.
 * Honest-gap: with no `GUIDANCE_URL` configured (or an unavailable store),
 * returns `[]` rather than a fabricated fixture. Throws on manifest drift — same
 * gate as `validate:guidance`.
 */
export async function loadGuidance(): Promise<Guidance[]> {
  const url = guidanceUrl();
  if (!url) {
    return [];
  }
  const response = await globalThis.fetch(url);
  if (!response.ok) {
    return [];
  }
  const manifests = (await response.json()) as unknown[];
  const byId = new Map<string, Guidance>(
    manifests.map((entry) => {
      const raw = GuidanceSchema.parse(entry) as unknown as Record<string, unknown>;
      return [raw.id as string, toGuidance(raw)] as const;
    }),
  );
  const ordered = ORDER.filter((id) => byId.has(id));
  const extras = [...byId.keys()].filter((id) => !ORDER.includes(id)).sort();
  return [...ordered, ...extras].map((id) => byId.get(id)!);
}
