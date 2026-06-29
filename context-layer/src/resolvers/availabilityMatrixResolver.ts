import type { Source } from "@atlas/schema";
import type { AnchorResolver, ResolveRequest, ResolveResult } from "./resolverTypes";
import {
  parseAvailabilityPage,
  type ParsedAvailabilityPage,
} from "../sourceContent/confluenceAvailabilityProvider";
import { fetchConfluenceStorageHtml } from "../sourceContent/confluenceCloudContentProvider";

/**
 * Availability matrix resolver (ADR-0009, plan 021 G3).
 *
 * A governed Source holds a region × Service availability table. Since G3 the
 * table is the per-LZ availability Confluence page (single live path, 018 G1):
 * the resolver fetches + parses it at request time — dev/integration = MSW, prod
 * = real — exactly like every other source, never an in-memory provider. It then
 * answers at the grain the binding's `selector` pins:
 *
 *   - service + region  -> a cell   ("Amazon S3 is available in us-east-1")
 *   - service only      -> a row    ("Amazon S3 — us-east-1: available; …")
 *   - region only       -> a column ("us-east-1 — Amazon S3: available; …")
 *
 * The service is matched by its machine id (selector "S3"/"Textract" → row id
 * `s3`/`textract`); region columns are the page's region-kind locations. On a
 * fetch/parse failure the resolver returns NO availability data plus a warning —
 * never a stale matrix (ADR-0009 §4): honesty over resilience.
 */

type AvailabilityMatrix = {
  /** Region columns in page order (region-kind locations only). */
  regions: string[];
  /** service id (lower-cased) -> row. */
  services: Map<string, ServiceRow>;
};

type ServiceRow = {
  /** Display name as written on the page (e.g. "Amazon S3"). */
  service: string;
  /** location id (lower-cased) -> status (e.g. "available"). */
  statuses: Map<string, string>;
};

export const availabilityMatrixResolver: AnchorResolver = {
  sourceClass: "availability-matrix",
  async resolve(request: ResolveRequest): Promise<ResolveResult> {
    const { source, selector, citationLabel, ctx } = request;

    // Single live path: the table is ALWAYS fetched from Confluence Cloud — the
    // caller's Bearer first (so it resolves under the caller's ACL), else the
    // narrow-scoped service token. No channel = honest dead-end, never a fake.
    const env = readProcessEnv();
    const token = ctx.token ?? env.ATLAS_CONFLUENCE_TOKEN;
    const baseUrl = env.ATLAS_CONFLUENCE_BASE_URL;
    const email = env.ATLAS_CONFLUENCE_EMAIL;
    if (!token || !baseUrl) {
      return unavailable(source.id);
    }

    const fetched = await fetchConfluenceStorageHtml(
      ctx,
      { token, baseUrl, email },
      source.location,
    );
    if (!fetched.ok) {
      return unavailable(source.id);
    }

    const matrix = buildMatrix(parseAvailabilityPage(fetched.html));
    if (matrix.services.size === 0) {
      return unavailable(source.id);
    }

    const location = fetched.webui
      ? `${baseUrl.replace(/\/+$/, "")}${fetched.webui}`
      : source.location;
    return resolveAtGrain(source, location, selector ?? {}, citationLabel, matrix);
  },
};

/** Build the region × service matrix from the parsed availability page. */
function buildMatrix(parsed: ParsedAvailabilityPage): AvailabilityMatrix {
  const regions = parsed.locations.filter((l) => l.kind === "region").map((l) => l.id);
  const services = new Map<string, ServiceRow>();
  for (const service of parsed.services) {
    const statuses = new Map<string, string>();
    for (const [locationId, entry] of Object.entries(service.availability)) {
      statuses.set(locationId.toLowerCase(), entry.status);
    }
    services.set(service.id.toLowerCase(), { service: service.name, statuses });
  }
  return { regions, services };
}

function resolveAtGrain(
  source: Source,
  location: string,
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
    return excerpt(source, location, label, `${row.service} is ${status} in ${region}.`);
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
    return excerpt(source, location, label, `${row.service} — ${cells.join("; ")}.`);
  }

  // Column: only the region is pinned.
  if (region) {
    if (!matrix.regions.some((col) => col.toLowerCase() === region.toLowerCase())) {
      return brokenAnchor(source.id, `region "${region}" is not in the matrix`);
    }
    const cells = [...matrix.services.values()].map(
      (row) => `${row.service}: ${row.statuses.get(region.toLowerCase()) ?? "not-planned"}`,
    );
    return excerpt(source, location, label, `${region} — ${cells.join("; ")}.`);
  }

  // An availability selector must pin at least one axis.
  return brokenAnchor(source.id, "selector pins neither a service nor a region");
}

function excerpt(
  source: Source,
  location: string,
  label: string | undefined,
  text: string,
): ResolveResult {
  return {
    excerpts: [
      {
        text,
        citation: {
          source_id: source.id,
          label: label ?? source.title,
          location,
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

/** Honest dead-end (ADR-0009 §4): the page could not be fetched/parsed. */
function unavailable(sourceId: string): ResolveResult {
  return {
    excerpts: [],
    warnings: [
      {
        code: "availability_unavailable",
        message:
          "Availability matrix could not be fetched or parsed; no availability data is returned.",
        source_id: sourceId,
      },
    ],
  };
}

function stringSelector(selector: Record<string, string>, key: string): string | undefined {
  const value = selector[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
