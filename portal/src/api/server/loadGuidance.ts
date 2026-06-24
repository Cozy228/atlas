/**
 * Guidance data loader — pure, server/node-safe (no react-start).
 *
 * Reads the route-guidance manifests (`data/guidance/*.yaml`, the single source
 * of truth) at call time, validates each against `@atlas/schema`'s
 * `GuidanceSchema`, and maps the snake_case manifest to the camelCase shape the
 * portal lib consumes. This replaces the build-time codegen (`gen-guidance.mjs`)
 * so guidance loads like every other source (release notes, registry) — and can
 * later come from a remote manifest, not just the local file.
 *
 * Kept free of `@tanstack/react-start` so cross-package consumers (e.g.
 * @atlas/acceptance) can load guidance through the package barrel without
 * pulling the server-fn runtime; the `fetchGuidance` server fn in `./guidance`
 * wraps this.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { resolveDataDir } from "@atlas/context-layer";
import { GuidanceSchema } from "@atlas/schema";
// Relative (not the portal-only "@/" alias) so cross-package consumers that
// reach this via the barrel (e.g. @atlas/acceptance) resolve it under tsc.
import type { Guidance } from "../../lib/guidance";

// Display/order contract (kept from gen-guidance): keeps the guidance list order
// stable across runs regardless of filesystem read order. Any manifest not listed
// is appended alphabetically so a new file is never silently dropped.
const ORDER = ["new-app-onboarding", "api-gateway-adoption", "s3-adoption", "textract-adoption"];

/** Map a validated snake_case manifest to the portal's camelCase Guidance. */
function toGuidance(raw: Record<string, unknown>): Guidance {
  const applies = raw.applies_to as
    | { services?: string[]; landing_zones?: string[]; guardrails?: string[] }
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
            ...(applies.guardrails ? { guardrails: applies.guardrails } : {}),
          },
        }
      : {}),
    ...(raw.sources ? { sources: raw.sources as ReadonlyArray<string> } : {}),
  };
}

/** Read + validate every guidance manifest, in the display-order contract. */
export function loadGuidance(dir: string = join(resolveDataDir(), "guidance")): Guidance[] {
  const byId = new Map<string, Guidance>(
    readdirSync(dir)
      .filter((file) => file.endsWith(".yaml"))
      .map((file) => {
        const raw = parse(readFileSync(join(dir, file), "utf8")) as Record<string, unknown>;
        GuidanceSchema.parse(raw); // throws on manifest drift — same gate as validate:guidance
        return [raw.id as string, toGuidance(raw)] as const;
      }),
  );
  const ordered = ORDER.filter((id) => byId.has(id));
  const extras = [...byId.keys()].filter((id) => !ORDER.includes(id)).sort();
  return [...ordered, ...extras].map((id) => byId.get(id)!);
}
