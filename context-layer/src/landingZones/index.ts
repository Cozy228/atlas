/**
 * Landing-zone discovery root (ADR-0017). The LZ list is the ONE hardcoded input
 * — availability, services, and links are discovered from it. Two layers kept
 * separate: the `LANDING_ZONES` topology constant (dev=prod, schema-validated)
 * and each LZ's env-bound availability-source locator (`resolveLandingZoneSource`,
 * dev→MSW / prod→real). Not a dev seed, not `data/*.yaml`, not an `@atlas/schema`
 * instance — the schema package holds the `LandingZone` shape only.
 */
export { LANDING_ZONES } from "./landingZones";
export { resolveLandingZoneSource, type LandingZoneSource } from "./landingZoneSource";
