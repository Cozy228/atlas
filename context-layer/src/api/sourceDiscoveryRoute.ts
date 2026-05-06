import {
  SourceDiscoveryRequestSchema,
  type ApiErrorResponse,
  type SourceDiscoveryResponse,
} from "@atlas/schema";
import {
  createDefaultContextBundleService,
  discoverSources,
} from "../services/contextBundleService.js";
import type { ApiResponse } from "./routeTypes.js";
import { errorResponse } from "./routeTypes.js";

export function handleSourceDiscoveryRequest(
  input: unknown,
): ApiResponse<ApiErrorResponse | SourceDiscoveryResponse> {
  const parsed = SourceDiscoveryRequestSchema.safeParse(input);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "Source discovery request is invalid.");
  }

  return {
    status: 200,
    body: discoverSources(createDefaultContextBundleService(), parsed.data),
  };
}
