import { LandingZoneSchema, type LandingZone } from "@atlas/schema";

/**
 * The landing-zone topology constant (ADR-0017 d.2/d.3): the ONE hardcoded
 * discovery root. Everything below an LZ — availability, services, links — is
 * discovered, not seeded; this list is the deployment topology an organization
 * already knows (dev=prod, so NOT a dev seed and NOT `data/*.yaml`).
 *
 * `cloud`/`tier` are attributes, never the identity; an LZ never spans clouds.
 * `dataStatus` is per-LZ honesty (ADR-0006): `awsf` is wired (`available`);
 * `awsc`/`azure` are registered targets with `not-available` — an honest
 * dead-end, never another LZ's data. Sample ids are public-safe placeholders.
 *
 * Schema-validated at module load so a malformed entry fails fast on import.
 */
export const LANDING_ZONES: readonly LandingZone[] = (
  [
    { id: "awsf", name: "AWS Foundation", cloud: "aws", dataStatus: "available" },
    { id: "awsc", name: "AWS Commercial", cloud: "aws", dataStatus: "not-available" },
    { id: "azure", name: "Azure", cloud: "azure", dataStatus: "not-available" },
  ] satisfies LandingZone[]
).map((zone) => LandingZoneSchema.parse(zone));
