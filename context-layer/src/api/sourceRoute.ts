import { type ApiErrorResponse, type SourceResponse } from "@atlas/schema";
import { createDefaultContextService } from "../composition";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

export function handleSourceRequest(
  sourceId: string,
): ApiResponse<ApiErrorResponse | SourceResponse> {
  const service = createDefaultContextService();
  const source = service.registry.sources.getById(sourceId);

  if (!source) {
    return errorResponse(404, "source_not_found", "Source was not found in the Atlas registry.");
  }

  return { status: 200, body: { source } };
}
