import { type ApiErrorResponse, type SourceResponse } from "@atlas/schema";
import { createDefaultContextService } from "../composition";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

export async function handleSourceRequest(
  sourceId: string,
): Promise<ApiResponse<ApiErrorResponse | SourceResponse>> {
  const service = await createDefaultContextService();
  const source = service.registry.sources.getById(sourceId);

  if (!source) {
    return errorResponse(404, "source_not_found", "Source was not found in the Atlas registry.");
  }

  return { status: 200, body: { source } };
}
