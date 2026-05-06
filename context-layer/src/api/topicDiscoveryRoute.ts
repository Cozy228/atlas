import {
  TopicDiscoveryRequestSchema,
  type ApiErrorResponse,
  type TopicDiscoveryResponse,
} from "@atlas/schema";
import {
  createDefaultContextBundleService,
  discoverTopics,
} from "../services/contextBundleService.js";
import type { ApiResponse } from "./routeTypes.js";
import { errorResponse } from "./routeTypes.js";

export function handleTopicDiscoveryRequest(
  input: unknown,
): ApiResponse<ApiErrorResponse | TopicDiscoveryResponse> {
  const parsed = TopicDiscoveryRequestSchema.safeParse(input);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "Topic discovery request is invalid.");
  }

  return {
    status: 200,
    body: discoverTopics(createDefaultContextBundleService(), parsed.data),
  };
}
