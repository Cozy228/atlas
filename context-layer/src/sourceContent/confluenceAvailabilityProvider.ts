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
  type LocationKind,
  type LocationStatus,
  type ServiceIdentity,
} from "@atlas/schema";
import { parse, type HTMLElement } from "node-html-parser";
import { LANDING_ZONES, LOCATION_GEO, resolveLandingZoneSource } from "../landingZones";
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

/**
 * Emoticon → status fallback, keyed by the Confluence `ac:emoji-shortname` /
 * `ac:emoji-fallback` glyph. The page's own Legend overrides these at parse time
 * (`parseLegend`); the map is the safety net when the Legend is absent/garbled.
 * Note the three non-tick statuses share `ac:name="blue-star"` — the glyph, never
 * the emoticon name, carries the meaning.
 */
const DEFAULT_STATUS_BY_GLYPH: Record<string, LocationStatus> = {
  ":check_mark:": "available",
  ":emo:": "interim",
  ":arrow_upper_right:": "planned",
  "↗️": "planned",
  ":regional_indicator_x:": "not-planned",
  "❌": "not-planned",
};

/**
 * Parse the availability page storage HTML into locations + services. The
 * inverse of `renderAvailabilityPageStorage`. The real page shape (ADR-0017):
 *
 *   - a Legend `<p>` mapping `<ac:emoticon>` glyphs → statuses;
 *   - one or more matrix `<table>`s, each headed by a `Regions` / `Outposts` row
 *     (→ the location columns + their `kind`), followed by a `Landing Zones` row,
 *     `colspan` domain-section headers, and service rows whose cells carry an
 *     `<ac:emoticon>` (→ status) plus optional trailing text (→ note).
 *
 * A service repeated across the region + outpost tables is merged by derived id
 * (availability = the column union). Tolerant of an absent/garbled table (returns
 * whatever it can), so a malformed page yields an honest-empty grid, never a throw.
 */
export function parseAvailabilityPage(html: string): ParsedAvailabilityPage {
  const root = parse(html);
  const legend = parseLegend(root);
  const locations = new Map<string, Location>();
  const services = new Map<string, AvailabilityServiceRow>();
  for (const table of findMatrixTables(root)) {
    parseMatrixTable(table, legend, locations, services);
  }
  return { locations: [...locations.values()], services: [...services.values()] };
}

/** Lower-cased tag name (`ac:emoticon`, `ac:link-body`, …) of a node, or "". */
function tagOf(node: unknown): string {
  return ((node as HTMLElement).rawTagName ?? "").toLowerCase();
}

/** Find the first descendant element with the given (namespaced) tag name. */
function firstTag(el: HTMLElement, name: string): HTMLElement | undefined {
  return el.querySelectorAll("*").find((child) => tagOf(child) === name);
}

/** A slug id: lower-case, non-alphanumerics → single hyphen, trimmed. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build the glyph → status map from the page Legend, seeded with the defaults so
 * the four known statuses are always resolvable. The Legend is the `<p>` that
 * mentions "Legend" and carries emoticons; each emoticon is followed by its label
 * text ("= Available"), which normalizes to a status enum.
 */
function parseLegend(root: HTMLElement): Map<string, LocationStatus> {
  const map = new Map<string, LocationStatus>(
    Object.entries(DEFAULT_STATUS_BY_GLYPH) as [string, LocationStatus][],
  );
  const legend = root
    .querySelectorAll("p")
    .find((p) => /legend/i.test(p.text) && firstTag(p, "ac:emoticon"));
  if (!legend) {
    return map;
  }
  let pending: string[] | undefined;
  for (const node of legend.childNodes) {
    if (tagOf(node) === "ac:emoticon") {
      const el = node as HTMLElement;
      pending = [
        el.getAttribute("ac:emoji-shortname"),
        el.getAttribute("ac:emoji-fallback"),
      ].filter((glyph): glyph is string => Boolean(glyph));
      continue;
    }
    const text = (node as HTMLElement).text?.trim();
    if (pending && text) {
      const status = normalizeStatus(text);
      if (status) {
        for (const glyph of pending) {
          map.set(glyph, status);
        }
      }
      pending = undefined;
    }
  }
  return map;
}

/** Legend label text → status enum. "Future availability" → `planned`. */
function normalizeStatus(text: string): LocationStatus | undefined {
  const t = text.toLowerCase();
  if (/not[\s-]?planned/.test(t)) return "not-planned";
  if (/interim/.test(t)) return "interim";
  if (/future/.test(t)) return "planned";
  if (/available/.test(t)) return "available";
  return undefined;
}

/** Matrix tables are the ones headed by a `Regions` / `Outposts` row (skips the
 *  decorative At-a-glance summary table, whose header is "Total Services"). */
function findMatrixTables(root: HTMLElement): HTMLElement[] {
  return root.querySelectorAll("table").filter((table) =>
    table.querySelectorAll("tr").some((tr) => {
      const first = cellsOf(tr)[0];
      return first ? /regions|outposts/i.test(first.text) : false;
    }),
  );
}

function cellsOf(row: HTMLElement): HTMLElement[] {
  return row.querySelectorAll("td, th");
}

/**
 * Parse one matrix table into the shared `locations` / `services` maps. Columns
 * (and their `kind`) come from the `Regions` / `Outposts` header row; rows below
 * are classified by shape: a lone (colspan) cell is a domain-section header, a
 * `Landing Zones` row is skipped, everything else is a service row whose status
 * cells align by column index to the header's locations.
 */
function parseMatrixTable(
  table: HTMLElement,
  legend: Map<string, LocationStatus>,
  locations: Map<string, Location>,
  services: Map<string, AvailabilityServiceRow>,
): void {
  const rows = table.querySelectorAll("tr");
  const headerIdx = rows.findIndex((row) => {
    const first = cellsOf(row)[0];
    return first ? /regions|outposts/i.test(first.text) : false;
  });
  if (headerIdx < 0) {
    return;
  }
  const headerCells = cellsOf(rows[headerIdx]!);
  const kind: LocationKind = /outpost/i.test(headerCells[0]?.text ?? "") ? "outpost" : "region";
  const columns = headerCells.slice(1).map((cell) => parseLocationLabel(cell.text, kind));
  for (const location of columns) {
    if (location && !locations.has(location.id)) {
      locations.set(location.id, location);
    }
  }

  let domain = "";
  for (const row of rows.slice(headerIdx + 1)) {
    const cells = cellsOf(row);
    if (cells.length === 0) {
      continue;
    }
    // The Landing Zones row also leads with an <h2>, so classify it before the
    // heading check below — otherwise it would be read as a domain section.
    if (/landing zones/i.test(cells[0]!.text)) {
      continue;
    }
    // A domain-section header: either a lone colspan cell, or a full row whose
    // first cell is an <h2> heading with the remaining cells left blank (the real
    // page's shape — NOT colspan). A service row carries its name in a <p>/link,
    // never a heading, so this never swallows a service.
    if (cells.length === 1 || isHeadingCell(cells[0]!)) {
      domain = cleanSectionTitle(cells[0]!.text);
      continue;
    }
    const name = serviceName(cells[0]!);
    if (!name) {
      continue;
    }
    const id = deriveServiceId(name);
    const row0 = services.get(id);
    const availability: Record<string, LocationAvailability> = { ...row0?.availability };
    columns.forEach((location, index) => {
      if (!location) {
        return;
      }
      const decoded = decodeStatusCell(cells[index + 1], legend);
      if (decoded) {
        availability[location.id] = decoded;
      }
    });
    if (row0) {
      row0.availability = availability;
    } else {
      services.set(id, { id, name, domain, iconKey: deriveIconKey(name, id), availability });
    }
  }
}

/** "US-EAST-1 (North Virginia)" → a `Location` (id = slug of the label). */
function parseLocationLabel(text: string, kind: LocationKind): Location | undefined {
  const clean = text.trim();
  if (!clean) {
    return undefined;
  }
  const match = clean.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const label = (match ? match[1] : clean).trim();
  const sub = (match ? match[2] : "").trim();
  return { id: slug(label), label, sub, kind };
}

/** A section-header cell leads with an <h1>–<h6> heading; a service cell uses a
 *  <p>/link. This is what tells a "Containers" section row from a service row. */
function isHeadingCell(cell: HTMLElement): boolean {
  return cell.querySelector("h1, h2, h3, h4, h5, h6") != null;
}

/** Drop a leading swatch/emoji ("■", "🔵", &nbsp;) up to the first word char. */
function cleanSectionTitle(text: string): string {
  return text.replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

/** The service's display name: the `<ac:link-body>` text, else the cell text. */
function serviceName(cell: HTMLElement): string {
  const body = firstTag(cell, "ac:link-body");
  return (body ? body.text : cell.text).trim();
}

/**
 * Derive the machine id from the display name — the real page has no id column.
 * A parenthetical all-caps acronym wins ("Elastic File System (EFS)" → `efs`),
 * else strip a leading vendor token and slug the rest ("Amazon S3" → `s3`).
 */
function deriveServiceId(name: string): string {
  const acronym = name.match(/\(([A-Z0-9]{2,})\)/);
  if (acronym) {
    return acronym[1]!.toLowerCase();
  }
  return slug(name.replace(/^(aws|amazon)\s+/i, ""));
}

/** A short presentation key (the acronym, else the first alphanumerics upper-cased). */
function deriveIconKey(name: string, id: string): string {
  const acronym = name.match(/\(([A-Z0-9]{2,})\)/);
  if (acronym) {
    return acronym[1]!.toUpperCase();
  }
  return (id.replace(/[^a-z0-9]/g, "").slice(0, 3) || id).toUpperCase();
}

/**
 * Decode a status cell: the `<ac:emoticon>` glyph → status (via the legend), the
 * trailing text → note (ETA / caveat). No emoticon → absent (⇒ not-planned).
 */
function decodeStatusCell(
  cell: HTMLElement | undefined,
  legend: Map<string, LocationStatus>,
): LocationAvailability | undefined {
  if (!cell) {
    return undefined;
  }
  const emoticon = firstTag(cell, "ac:emoticon");
  if (!emoticon) {
    return undefined;
  }
  const status =
    legend.get(emoticon.getAttribute("ac:emoji-shortname") ?? "") ??
    legend.get(emoticon.getAttribute("ac:emoji-fallback") ?? "");
  if (!status) {
    return undefined;
  }
  const note = cell.text.trim();
  return note ? { status, note } : { status };
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
    locations: parsed.locations.map(withGeo),
    services: parsed.services.map(toAvailabilityRecord),
  };
}

/**
 * Enrich a parsed location with map coordinates. The availability page does not
 * carry geography, so coordinates are looked up by id from `LOCATION_GEO`
 * (public region geography + fictional outpost sites) — kept out of the parse so
 * the page stays the single source for *availability*, geo a separate reference.
 */
function withGeo(location: Location): Location {
  const coordinates = LOCATION_GEO[location.id];
  return coordinates ? { ...location, coordinates } : location;
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
