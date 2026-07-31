import { type ApiErrorResponse, type AvailabilityReadResponse } from "@atlas/schema";
import { createDefaultContextService } from "../composition";
import {
  AvailabilitySourceNotFoundError,
  readAvailability,
} from "../services/availabilityReadService";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

/**
 * The single availability read (plan 014).
 *
 * Returns the structured grid every consumer renders (zones -> services ->
 * {location -> status}), paired with the governing Citation and the freshness
 * warnings of the registered `availability-matrix` Source. Portal, the MCP
 * `atlas_check_availability` tool, and the agent resource `availability` section
 * all read THIS one cited source of record, so they can never diverge.
 *
 * The grid comes from the injected `AvailabilityProvider` port, which discovers
 * each landing zone's availability by live-fetching + parsing its bound
 * Confluence page (dev → MSW, prod → the real space; plan 021 G3) — one live
 * path, no in-memory dataset. A missing Source 404s rather than serving an
 * uncited grid — honesty over resilience (ADR-0009 §4).
 */
export async function handleAvailabilityRequest(): Promise<
  ApiResponse<ApiErrorResponse | AvailabilityReadResponse>
> {
  const service = await createDefaultContextService();
  try {
    return { status: 200, body: await readAvailability(service) };
  } catch (error) {
    if (error instanceof AvailabilitySourceNotFoundError) {
      return errorResponse(404, "source_not_found", error.message);
    }
    throw error;
  }
}
