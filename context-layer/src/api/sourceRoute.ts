import { type ApiErrorResponse, type SourceResponse } from "@atlas/schema";
import { createDefaultContextService } from "../composition";
import { gateSource } from "../resolvers/appScopeGate";
import type { ResolutionContext } from "../resolvers/resolverTypes";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

export async function handleSourceRequest(
  sourceId: string,
  ctx: Pick<ResolutionContext, "verifiedApps">,
): Promise<ApiResponse<ApiErrorResponse | SourceResponse>> {
  const service = await createDefaultContextService();
  // App-scope gate (WS4): a `visibility:"app"` Source not in the caller's verified set
  // reads as absent (404) — indistinguishable from a non-existent id, so an unverified
  // caller (incl. the MCP `atlas_get_source` tool) cannot confirm its existence.
  const source = gateSource(service.registry.sources.getById(sourceId), ctx);

  if (!source) {
    return errorResponse(404, "source_not_found", "Source was not found in the Atlas registry.");
  }

  return { status: 200, body: { source } };
}
