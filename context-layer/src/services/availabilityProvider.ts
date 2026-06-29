import type { LandingZoneAvailability, ServiceIdentity } from "@atlas/schema";

/**
 * Port for the LZ-aware availability read (plan 014, plan 021 G3). The core
 * exposes the cited grid every consumer renders (Portal Explore, the MCP
 * `atlas_get_availability` tool, the agent `availability` section) without binding
 * to any one source of bytes: the live provider iterates the landing-zone root and
 * fetch+parses each wired LZ's Confluence availability page through MSW/prod
 * (single live path). A landing zone with no wired source returns an empty grid —
 * honesty over a fabricated one (ADR-0006/ADR-0009 §4). Async because every read
 * is a live fetch, never an in-memory dataset (018 G1).
 */
export type AvailabilityProvider = {
  /** Per-landing-zone grids: a wired LZ's discovered grid, an unwired LZ empty. */
  getZones(): Promise<LandingZoneAvailability[]>;
  /**
   * The authoritative spine of WHICH services exist (plan 017 decision #2, B2):
   * the wired grids flattened into normalized `ServiceIdentity`s, deduped by
   * canonical `{cloud}/{id}` key. `provider` is the LZ's CLOUD — the landing-zone
   * id never enters the service address (ADR-0017 d.4), so a slug stays
   * `aws/textract` across LZs sharing a cloud. Discovery iterates whatever this
   * returns; N is data, not a design knob.
   */
  listServices(): Promise<ServiceIdentity[]>;
};
