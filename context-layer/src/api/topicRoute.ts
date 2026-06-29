import { type ApiErrorResponse, type TopicResponse } from "@atlas/schema";
import { createDefaultContextService } from "../composition";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

export function handleTopicRequest(topicId: string): ApiResponse<ApiErrorResponse | TopicResponse> {
  const service = createDefaultContextService();
  const topic = service.registry.topics.getById(topicId);

  if (!topic) {
    return errorResponse(404, "topic_not_found", "Topic was not found in the Atlas registry.");
  }

  return { status: 200, body: { topic } };
}
