/**
 * Live, LZ-aware availability provider (plan 021 G3, ADR-0017).
 *
 * The landing zone is the discovery root: this provider iterates `LANDING_ZONES`
 * and, for each LZ whose availability source is wired (env-resolved locator),
 * fetches + parses its bound Confluence availability page — the single live path
 * (018 G1), dev/integration = MSW, prod = real. An LZ with no wired source
 * (`dataStatus: "not-available"`) returns an empty grid: an honest per-LZ
 * dead-end (ADR-0006), never another LZ's data, never a fabrication.
 *
 * `getZones()` is keyed by landing zone (`id = awsf`, `cloud` an attribute);
 * `listServices()` flattens the wired grids into the discovery spine, keyed by
 * canonical `{cloud}/{id}` — the LZ id never enters the service address (ADR-0017
 * d.4), so a service slug stays `aws/textract` across LZs that share a cloud.
 */
import {
  type AvailabilityRecord,
  type LandingZone,
  type LandingZoneAvailability,
  type Location,
  type LocationAvailability,
  type LocationStatus,
  type ServiceIdentity,
  locationKinds,
  locationStatuses,
} from "@atlas/schema";
import { parse, type HTMLElement } from "node-html-parser";
import { LANDING_ZONES, resolveLandingZoneSource } from "../landingZones";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import { normalizeServiceIdentity } from "../services/serviceIdentityNormalizer";
import type { FetchLike } from "../resolvers/resolverTypes";
import { fetchConfluenceStorageHtml } from "./confluenceCloudContentProvider";

/** A parsed service row: presentation + per-location availability. */
export type AvailabilityServiceRow = {
  id: string;
  name: string;
  domain: string;
  iconKey: string;
  availability: Record<string, LocationAvailability>;
};

export type ParsedAvailabilityPage = {
  locations: Location[];
  services: AvailabilityServiceRow[];
};

const LOCATION_KINDS = new Set<string>(locationKinds);
const LOCATION_STATUSES = new Set<string>(locationStatuses);
const STATUS_SEP = " · ";

/**
 * Parse the availability page storage HTML back into locations + services. The
 * inverse of `renderAvailabilityPageStorage`: two tables (`data-table` =
 * "locations" / "services"), each a header row + data rows. Tolerant of an
 * absent/garbled table (returns whatever it can), so a malformed page yields an
 * honest-empty grid rather than throwing.
 */
export function parseAvailabilityPage(html: string): ParsedAvailabilityPage {
  const root = parse(html);
  const tables = root.querySelectorAll("table");
  const locTable = tables.find((table) => table.getAttribute("data-table") === "locations");
  const svcTable = tables.find((table) => table.getAttribute("data-table") === "services");

  return {
    locations: locTable ? parseLocations(locTable) : [],
    services: svcTable ? parseServices(svcTable) : [],
  };
}

function rowsOf(table: HTMLElement): string[][] {
  return table
    .querySelectorAll("tr")
    .map((tr) => tr.querySelectorAll("td").map((td) => td.text.trim()));
}

function parseLocations(table: HTMLElement): Location[] {
  const rows = rowsOf(table);
  const locations: Location[] = [];
  // rows[0] is the header (id/label/sub/kind/lon/lat).
  for (const cells of rows.slice(1)) {
    const [id, label, sub, kind, lon, lat] = cells;
    if (!id || !LOCATION_KINDS.has(kind ?? "")) {
      continue;
    }
    const coordinates =
      lon && lat && Number.isFinite(Number(lon)) && Number.isFinite(Number(lat))
        ? ([Number(lon), Number(lat)] as [number, number])
        : undefined;
    locations.push({
      id,
      label: label ?? id,
      sub: sub ?? "",
      kind: kind as Location["kind"],
      ...(coordinates ? { coordinates } : {}),
    });
  }
  return locations;
}

function parseServices(table: HTMLElement): AvailabilityServiceRow[] {
  const rows = rowsOf(table);
  if (rows.length < 2) {
    return [];
  }
  const header = rows[0]!;
  // Columns: id, name, domain, icon, then one location-id column per location.
  const locationIds = header.slice(4);
  const services: AvailabilityServiceRow[] = [];
  for (const cells of rows.slice(1)) {
    const id = cells[0];
    if (!id) {
      continue;
    }
    const availability: Record<string, LocationAvailability> = {};
    locationIds.forEach((locationId, index) => {
      const decoded = decodeCell(cells[index + 4]);
      if (decoded) {
        availability[locationId] = decoded;
      }
    });
    services.push({
      id,
      name: cells[1] || id,
      domain: cells[2] || "",
      iconKey: cells[3] || id.toUpperCase(),
      availability,
    });
  }
  return services;
}

/** Decode a cell (`status` or `status · note`); empty/unknown → absent (not-planned). */
function decodeCell(value: string | undefined): LocationAvailability | undefined {
  const text = value?.trim();
  if (!text) {
    return undefined;
  }
  const [status, note] = text.split(STATUS_SEP);
  if (!LOCATION_STATUSES.has(status ?? "")) {
    return undefined;
  }
  return { status: status as LocationStatus, ...(note ? { note } : {}) };
}

export type ConfluenceAvailabilityProviderDeps = {
  /** Late-bound fetch (dev MSW / prod real). */
  fetch: FetchLike;
  /** Process env supplying the per-LZ availability-source locators. */
  env?: Record<string, string | undefined>;
  /** The LZ list to iterate (defaults to the topology root). */
  landingZones?: readonly LandingZone[];
};

/**
 * Build the LZ-aware availability provider. The grid is fetched + parsed per
 * request and never materialized (ADR-0013/0014); a per-instance memo collapses
 * the `getZones`/`listServices` double-read to one fetch per LZ per request.
 */
export function createConfluenceAvailabilityProvider(
  deps: ConfluenceAvailabilityProviderDeps,
): AvailabilityProvider {
  const landingZones = deps.landingZones ?? LANDING_ZONES;
  let zonesPromise: Promise<LandingZoneAvailability[]> | undefined;

  function loadZones(): Promise<LandingZoneAvailability[]> {
    return (zonesPromise ??= Promise.all(landingZones.map((zone) => loadZone(deps, zone))));
  }

  return {
    getZones: () => loadZones(),
    listServices: async () => {
      const zones = await loadZones();
      return flattenSpine(zones);
    },
  };
}

/** Fetch + parse one wired LZ's availability page; an unwired LZ → empty grid. */
async function loadZone(
  deps: ConfluenceAvailabilityProviderDeps,
  zone: LandingZone,
): Promise<LandingZoneAvailability> {
  const base: LandingZoneAvailability = {
    id: zone.id,
    name: zone.name,
    cloud: zone.cloud,
    ...(zone.tier ? { tier: zone.tier } : {}),
    dataStatus: zone.dataStatus,
    locations: [],
    services: [],
  };

  const source = resolveLandingZoneSource(zone, deps.env);
  if (!source) {
    // Honest per-LZ dead-end: registered target, no wired availability source.
    return base;
  }

  const fetched = await fetchConfluenceStorageHtml(
    { fetch: deps.fetch },
    { token: source.token, baseUrl: source.baseUrl, email: source.email },
    source.pageId,
  );
  if (!fetched.ok) {
    return base;
  }

  const parsed = parseAvailabilityPage(fetched.html);
  return {
    ...base,
    locations: parsed.locations,
    services: parsed.services.map(toAvailabilityRecord),
  };
}

function toAvailabilityRecord(row: AvailabilityServiceRow): AvailabilityRecord {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    iconKey: row.iconKey,
    availability: row.availability,
  };
}

/**
 * Flatten wired grids into the discovery spine: one normalized `ServiceIdentity`
 * per service, `provider` = the LZ's cloud (NOT its id — the LZ never enters the
 * `{cloud}/{id}` address), deduped by canonical key (first occurrence wins).
 */
function flattenSpine(zones: LandingZoneAvailability[]): ServiceIdentity[] {
  const byKey = new Map<string, ServiceIdentity>();
  for (const zone of zones) {
    for (const service of zone.services) {
      const identity = normalizeServiceIdentity({
        provider: zone.cloud,
        id: service.id,
        name: service.name,
      });
      if (!byKey.has(identity.key)) {
        byKey.set(identity.key, identity);
      }
    }
  }
  return Array.from(byKey.values());
}
