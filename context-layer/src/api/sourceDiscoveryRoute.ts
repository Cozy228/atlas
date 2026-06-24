import {
  SourceDiscoveryRequestSchema,
  type ApiErrorResponse,
  type SourceDiscoveryResponse,
} from "@atlas/schema";
import {
  createDefaultContextBundleService,
  discoverSources,
} from "../services/contextBundleService";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

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
