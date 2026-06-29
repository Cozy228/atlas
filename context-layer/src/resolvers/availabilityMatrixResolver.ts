import type { Source } from "@atlas/schema";
import type { AnchorResolver, ResolveRequest, ResolveResult } from "./resolverTypes";

/**
 * Availability matrix resolver (ADR-0009).
 *
 * A governed Source holds a region × Service availability table. This resolver
 * parses it once into a structured matrix and answers at the grain the binding's
 * `selector` pins:
 *
 *   - service + region  -> a cell   ("S3 is available in us-east-1")
 *   - service only      -> a row    ("S3 — us-east-1: available; …")
 *   - region only       -> a column ("us-east-1 — S3: available; …")
 *
 * Query precision mirrors citation granularity: a precise selector gets a precise
 * answer, a fuzzy selector a fuzzy one. On a fetch/parse failure the resolver
 * returns NO availability data plus a warning — never a stale cached matrix
 * (ADR-0009 §4): honesty over resilience.
 */

/** The single governed content key that holds the raw availability table. */
const AVAILABILITY_TABLE_KEY = "availability-matrix";

type AvailabilityMatrix = {
  /** Region columns in source order, display-cased (e.g. "us-east-1"). */
  regions: string[];
  /** service (lower-cased key) -> row. */
  services: Map<string, ServiceRow>;
};

type ServiceRow = {
  /** Display-cased service name as written in the table (e.g. "S3"). */
  service: string;
  /** region (lower-cased key) -> status (e.g. "available"). */
  statuses: Map<string, string>;
};

/**
 * Lazy parse memo keyed by the raw table text. This is a performance
 * optimization only (ADR-0009 §1): a changed table parses under a new key, and
 * a parse FAILURE is never stored — so a malformed table can never resolve from
 * a previously-good entry. It is explicitly not a resilience fallback.
 */
const parseMemo = new Map<string, AvailabilityMatrix>();

export const availabilityMatrixResolver: AnchorResolver = {
  sourceClass: "availability-matrix",
  async resolve(request: ResolveRequest): Promise<ResolveResult> {
    const { source, selector, citationLabel, contentProvider } = request;

    // Availability stays dev until G3: the raw table is read from the injected
    // dev content provider, not fetched live.
    const rawTable = contentProvider?.getSourceContent(source.id)?.[AVAILABILITY_TABLE_KEY];
    const matrix = rawTable ? parseMatrix(rawTable) : undefined;
    if (!matrix) {
      return {
        excerpts: [],
        warnings: [
          {
            code: "availability_unavailable",
            message:
              "Availability matrix could not be fetched or parsed; no availability data is returned.",
            source_id: source.id,
          },
        ],
      };
    }

    return resolveAtGrain(source, selector ?? {}, citationLabel, matrix);
  },
};

function resolveAtGrain(
  source: Source,
  selector: Record<string, string>,
  label: string | undefined,
  matrix: AvailabilityMatrix,
): ResolveResult {
  const service = stringSelector(selector, "service");
  const region = stringSelector(selector, "region");

  // Cell: both axes pinned.
  if (service && region) {
    const row = matrix.services.get(service.toLowerCase());
    if (!row) {
      return brokenAnchor(source.id, `service "${service}" is not in the matrix`);
    }
    const status = row.statuses.get(region.toLowerCase()) ?? "not-planned";
    return excerpt(source, label, `${row.service} is ${status} in ${region}.`);
  }

  // Row: only the Service is pinned.
  if (service) {
    const row = matrix.services.get(service.toLowerCase());
    if (!row) {
      return brokenAnchor(source.id, `service "${service}" is not in the matrix`);
    }
    const cells = matrix.regions.map(
      (col) => `${col}: ${row.statuses.get(col.toLowerCase()) ?? "not-planned"}`,
    );
    return excerpt(source, label, `${row.service} — ${cells.join("; ")}.`);
  }

  // Column: only the region is pinned.
  if (region) {
    if (!matrix.regions.some((col) => col.toLowerCase() === region.toLowerCase())) {
      return brokenAnchor(source.id, `region "${region}" is not in the matrix`);
    }
    const cells = [...matrix.services.values()].map(
      (row) => `${row.service}: ${row.statuses.get(region.toLowerCase()) ?? "not-planned"}`,
    );
    return excerpt(source, label, `${region} — ${cells.join("; ")}.`);
  }

  // An availability selector must pin at least one axis.
  return brokenAnchor(source.id, "selector pins neither a service nor a region");
}

function excerpt(source: Source, label: string | undefined, text: string): ResolveResult {
  return {
    excerpts: [
      {
        text,
        citation: {
          source_id: source.id,
          label: label ?? source.title,
          location: source.location,
        },
      },
    ],
    warnings: [],
  };
}

function brokenAnchor(sourceId: string, reason: string): ResolveResult {
  return {
    excerpts: [],
    warnings: [
      {
        code: "broken_anchor",
        message: `Availability selector could not be resolved: ${reason}.`,
        source_id: sourceId,
      },
    ],
  };
}

/** Parse the governed markdown table into a structured matrix (memoized). */
function parseMatrix(raw: string): AvailabilityMatrix | undefined {
  const cached = parseMemo.get(raw);
  if (cached) {
    return cached;
  }
  const parsed = parseMarkdownMatrix(raw);
  if (parsed) {
    parseMemo.set(raw, parsed);
  }
  return parsed;
}

function parseMarkdownMatrix(raw: string): AvailabilityMatrix | undefined {
  const rows = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"))
    .map(splitRow);

  if (rows.length < 2) {
    return undefined;
  }

  const regions = rows[0]!.slice(1).filter((cell) => cell.length > 0);
  if (regions.length === 0) {
    return undefined;
  }

  const services = new Map<string, ServiceRow>();
  for (const cells of rows.slice(1)) {
    if (isSeparatorRow(cells)) {
      continue;
    }
    const service = cells[0]?.trim();
    if (!service) {
      continue;
    }
    const statuses = new Map<string, string>();
    regions.forEach((region, index) => {
      const status = cells[index + 1]?.trim();
      if (status) {
        statuses.set(region.toLowerCase(), status);
      }
    });
    services.set(service.toLowerCase(), { service, statuses });
  }

  if (services.size === 0) {
    return undefined;
  }
  return { regions, services };
}

function splitRow(line: string): string[] {
  const inner = line.slice(1, line.endsWith("|") ? -1 : undefined);
  return inner.split("|").map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function stringSelector(selector: Record<string, string>, key: string): string | undefined {
  const value = selector[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
