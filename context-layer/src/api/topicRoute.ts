import {
  type ApiErrorResponse,
  type TopicResponse,
} from "@atlas/schema";
import { createDefaultContextBundleService } from "../services/contextBundleService.js";
import type { ApiResponse } from "./routeTypes.js";
import { errorResponse } from "./routeTypes.js";

export function handleTopicRequest(
  topicId: string,
): ApiResponse<ApiErrorResponse | TopicResponse> {
  const service = createDefaultContextBundleService();
  const topic = service.registry.topics.getById(topicId);

  if (!topic) {
    return errorResponse(404, "topic_not_found", "Topic was not found in the Atlas registry.");
  }

  return { status: 200, body: { topic } };
}
