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

  const service = await createDefaultContextService();
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
  if (feedback.target_type === "resource" && !resourceExists(service, feedback.target_id)) {
    return errorResponse(404, "resource_not_found", "Feedback target resource was not found.");
  }
  if (feedback.target_type === "source" && !service.registry.sources.getById(feedback.target_id)) {
    return errorResponse(404, "source_not_found", "Feedback target source was not found.");
  }

  return undefined;
}

/** A feedback `resource` target is identified by its canonical `{kind}/{slug}` id. */
function resourceExists(service: ContextService, targetId: string): boolean {
  return service.resources.some((record) => `${record.kind}/${record.slug}` === targetId);
}

function toFeedback(submission: FeedbackSubmission): Feedback {
  return {
    id: `feedback-${Date.now().toString(36)}`,
    submitted_at: new Date().toISOString(),
    ...submission,
  };
}
