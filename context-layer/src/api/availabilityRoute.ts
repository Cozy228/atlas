import { type ApiErrorResponse, type AvailabilityReadResponse } from "@atlas/schema";
import { createDefaultContextBundleService } from "../services/contextBundleService";
import { availabilityZones } from "../sourceContent/availabilityFixture";
import { isStale } from "../services/freshness";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

/** The governed availability-matrix Source backing every availability read (ADR-0009). */
const AVAILABILITY_SOURCE_ID = "availability-matrix";

/**
 * The single availability read (plan 014).
 *
 * Returns the structured grid every consumer renders (zones -> services ->
 * {location -> status}), paired with the governing Citation and the freshness
 * warnings of the registered `availability-matrix` Source. Portal, the MCP
 * `atlas_get_availability` tool, and the agent resource `availability` section
 * all read THIS one cited source of record, so they can never diverge.
 *
 * Dev returns the relocated fixture; prod would live-fetch the same Confluence
 * page the matrix resolver hits (boundary TODO). A missing Source 404s rather
 * than serving an uncited grid — honesty over resilience (ADR-0009 §4).
 */
export function handleAvailabilityRequest(): ApiResponse<
  ApiErrorResponse | AvailabilityReadResponse
> {
  const service = createDefaultContextBundleService();
  const source = service.registry.sources.getById(AVAILABILITY_SOURCE_ID);
  if (!source) {
    return errorResponse(
      404,
      "source_not_found",
      "The availability matrix source is not registered.",
    );
  }

  const warnings: AvailabilityReadResponse["warnings"] = [];
  if (source.visibility === "restricted") {
    warnings.push({
      code: "restricted_source",
      message: "Source exists but has restricted visibility.",
      source_id: source.id,
    });
  }
  if (isStale(source, service.now)) {
    warnings.push({
      code: "stale_source",
      message: "Source is past its review frequency.",
      source_id: source.id,
    });
  }

  return {
    status: 200,
    body: {
      zones: availabilityZones,
      citation: {
        source_id: source.id,
        label: source.title,
        location: source.location,
      },
      warnings,
    },
  };
}
