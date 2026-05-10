import { describe, expect, it } from "vitest";
import { ApiErrorResponseSchema, FeedbackResponseSchema } from "@atlas/schema";
import { handleFeedbackRequest } from "./feedbackRoute.js";

describe("feedback route", () => {
  it("captures user feedback as a shared contract response", () => {
    const response = handleFeedbackRequest({
      target_type: "topic",
      target_id: "aws-textract",
      feedback_type: "stale",
      message: "The getting started guidance needs a new review.",
    });

    expect(response.status).toBe(201);
    const parsed = FeedbackResponseSchema.parse(response.body);
    expect(parsed.feedback).toMatchObject({
      target_type: "topic",
      target_id: "aws-textract",
      feedback_type: "stale",
      message: "The getting started guidance needs a new review.",
    });
    expect(parsed.feedback.id).toMatch(/^feedback-/);
  });

  it("returns structured invalid_request errors", () => {
    const response = handleFeedbackRequest({
      target_type: "topic",
      target_id: "",
      feedback_type: "stale",
      message: "",
    });

    expect(response.status).toBe(400);
    expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe("invalid_request");
  });

  it("returns structured not-found errors for unknown targets", () => {
    const response = handleFeedbackRequest({
      target_type: "topic",
      target_id: "missing-topic",
      feedback_type: "missing",
      message: "I expected this topic to exist.",
    });

    expect(response.status).toBe(404);
    expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe("topic_not_found");
  });
});
