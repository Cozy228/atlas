import { type ApiErrorResponse, type TopicResponse } from "@atlas/schema";
import { createDefaultContextService } from "../composition";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

export async function handleTopicRequest(
  topicId: string,
): Promise<ApiResponse<ApiErrorResponse | TopicResponse>> {
  const service = await createDefaultContextService();
  const topic = service.registry.topics.getById(topicId);

  if (!topic) {
    return errorResponse(404, "topic_not_found", "Topic was not found in the Atlas registry.");
  }

  return { status: 200, body: { topic } };
}
