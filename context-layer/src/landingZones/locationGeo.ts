/**
 * Location geography (map coordinates), keyed by location id.
 *
 * The availability Confluence page carries *availability*, not geography — a real
 * region row is just "US-EAST-1 (North Virginia)". Coordinates are reference data
 * the system adds on top, so they live here rather than being parsed from (or
 * faked into) the page. Regions use their publicly-known geography; the fictional
 * outposts (public-safe, no real sites) carry fictional coordinates.
 *
 * `[longitude, latitude]` in degrees. A location absent from this map simply
 * renders without a pin — an honest gap, never a fabricated point.
 */
export const LOCATION_GEO: Record<string, [number, number]> = {
  "us-east-1": [-78.0, 38.9],
  "ca-central-1": [-73.6, 45.5],
  gdc: [-0.1, 51.5],
  dc16: [8.7, 50.1],
  mt10: [103.8, 1.3],
};
