/**
 * Availability types + fetch for the Explore surface.
 *
 * Platform availability is a single source of record read through the Context
 * Layer (plan 014): the Portal Explore grid, the MCP `atlas_get_availability`
 * tool, and the agent resource `availability` section all consume ONE cited
 * read. This module re-exports the shared wire types and the `fetchAvailability`
 * server function so the Explore/catalog consumers keep their imports stable.
 * The standalone dataset that used to live here is retired — the cited read is now
 * LZ-aware and discovered per landing zone (plan 021 G3): the
 * `confluenceAvailabilityProvider` fetch+parses each wired LZ's availability page.
 */
export type {
  AvailabilityRecord,
  AvailabilityResponse,
  LandingZoneAvailability,
  LandingZoneCloud,
  Location,
  LocationAvailability,
  LocationKind,
  LocationStatus,
} from "@atlas/schema";

export { fetchAvailability } from "./contextApi";
