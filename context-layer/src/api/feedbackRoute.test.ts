import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiErrorResponseSchema, FeedbackResponseSchema } from "@atlas/schema";
import { setDevDiscoveryEnv } from "../devMocks";
import { handleFeedbackRequest } from "./feedbackRoute";

// Post-flip (plan 018 G5) the registry (incl. feedback targets) is the OUTPUT of
// live discovery; point every channel at the MSW fixtures so the target topic
// exists. The service topic id is now the resource slug (`aws/textract`).
const savedEnv = { ...process.env };
beforeAll(() => setDevDiscoveryEnv());
afterAll(() => {
  process.env = savedEnv;
});

describe("feedback route", () => {
  it("captures user feedback as a shared contract response", async () => {
    const response = await handleFeedbackRequest({
      target_type: "topic",
      target_id: "aws/textract",
      feedback_type: "stale",
      message: "The getting started guidance needs a new review.",
    });

    expect(response.status).toBe(201);
    const parsed = FeedbackResponseSchema.parse(response.body);
    expect(parsed.feedback).toMatchObject({
      target_type: "topic",
      target_id: "aws/textract",
      feedback_type: "stale",
      message: "The getting started guidance needs a new review.",
    });
    expect(parsed.feedback.id).toMatch(/^feedback-/);
  });

  it("returns structured invalid_request errors", async () => {
    const response = await handleFeedbackRequest({
      target_type: "topic",
      target_id: "",
      feedback_type: "stale",
      message: "",
    });

    expect(response.status).toBe(400);
    expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe("invalid_request");
  });

  it("returns structured not-found errors for unknown targets", async () => {
    const response = await handleFeedbackRequest({
      target_type: "topic",
      target_id: "missing-topic",
      feedback_type: "missing",
      message: "I expected this topic to exist.",
    });

    expect(response.status).toBe(404);
    expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe("topic_not_found");
  });
});
