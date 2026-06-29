import {
  FeedbackSubmissionSchema,
  type ApiErrorResponse,
  type Feedback,
  type FeedbackResponse,
  type FeedbackSubmission,
} from "@atlas/schema";
import { createDefaultContextService } from "../composition";
import type { ContextService } from "../services/contextService";
import type { ApiResponse } from "./routeTypes";
import { errorResponse } from "./routeTypes";

export async function handleFeedbackRequest(
  input: unknown,
): Promise<ApiResponse<ApiErrorResponse | FeedbackResponse>> {
  const parsed = FeedbackSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return errorResponse(400, "invalid_request", "Feedback request is invalid.");
  }

  const service = createDefaultContextService();
  const targetError = validateFeedbackTarget(service, parsed.data);
  if (targetError) {
    return targetError;
  }

  const feedback = await service.registry.feedback.put(toFeedback(parsed.data));
  return {
    status: 201,
    body: { feedback },
  };
}

function validateFeedbackTarget(
  service: ContextService,
  feedback: FeedbackSubmission,
): ApiResponse<ApiErrorResponse> | undefined {
  if (feedback.target_type === "topic" && !service.registry.topics.getById(feedback.target_id)) {
    return errorResponse(404, "topic_not_found", "Feedback target topic was not found.");
  }
  if (feedback.target_type === "source" && !service.registry.sources.getById(feedback.target_id)) {
    return errorResponse(404, "source_not_found", "Feedback target source was not found.");
  }
  if (feedback.target_type === "anchor" && !service.registry.anchors.getById(feedback.target_id)) {
    return errorResponse(422, "anchor_broken", "Feedback target anchor was not found.");
  }

  return undefined;
}

function toFeedback(submission: FeedbackSubmission): Feedback {
  return {
    id: `feedback-${Date.now().toString(36)}`,
    submitted_at: new Date().toISOString(),
    ...submission,
  };
}
