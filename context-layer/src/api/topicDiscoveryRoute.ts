import {
  TopicDiscoveryRequestSchema,
  type ApiErrorResponse,
  type TopicDiscoveryResponse,
} from "@atlas/schema";
import { discoverTopics } from "../services/contextService";
import { createDefaultContextService } from "../composition";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

export async function handleTopicDiscoveryRequest(
  input: unknown,
): Promise<ApiResponse<ApiErrorResponse | TopicDiscoveryResponse>> {
  const parsed = TopicDiscoveryRequestSchema.safeParse(input);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "Topic discovery request is invalid.");
  }

  return {
    status: 200,
    body: discoverTopics(await createDefaultContextService(), parsed.data),
  };
}
