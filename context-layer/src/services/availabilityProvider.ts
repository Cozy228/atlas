import type { LandingZoneData } from "@atlas/schema";

/**
 * Port for the single availability read (plan 014). The core exposes the cited
 * grid every consumer renders (Portal Explore, the MCP `atlas_get_availability`
 * tool, the agent `availability` section) without binding to any one source of
 * bytes: dev assembles an in-memory dataset, prod would live-fetch the same
 * Confluence page the matrix resolver hits. A provider that has no registered
 * source returns an empty grid — honesty over a fabricated one (ADR-0009 §4).
 */
export type AvailabilityProvider = {
  getZones(): LandingZoneData[];
};
