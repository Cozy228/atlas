import type { LandingZoneData, ServiceIdentity } from "@atlas/schema";

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
  /**
   * The authoritative spine of WHICH services exist (plan 017 decision #2, B2):
   * the availability grid flattened into normalized `ServiceIdentity`s, deduped
   * by canonical `{provider}/{id}` key across zones. `provider` is the zone id —
   * structural config metadata, never parsed from a markdown cell (B3). Discovery
   * iterates whatever this returns; N is data, not a design knob.
   */
  listServices(): ServiceIdentity[];
};
