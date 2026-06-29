import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ApiErrorResponseSchema, FeedbackResponseSchema } from "@atlas/schema";
import { setDevDiscoveryEnv } from "../devMocks";
import { handleFeedbackRequest } from "./feedbackRoute";

// Post-collapse the registry (incl. feedback targets) is the OUTPUT of live
// discovery; point every channel at the MSW fixtures so the target resource
// exists. A resource feedback target is the canonical `{kind}/{slug}` id.
const savedEnv = { ...process.env };
beforeAll(() => setDevDiscoveryEnv());
afterAll(() => {
  process.env = savedEnv;
});

describe("feedback route", () => {
  it("captures user feedback as a shared contract response", async () => {
    const response = await handleFeedbackRequest({
      target_type: "resource",
      target_id: "service/aws/textract",
      feedback_type: "stale",
      message: "The getting started guidance needs a new review.",
    });

    expect(response.status).toBe(201);
    const parsed = FeedbackResponseSchema.parse(response.body);
    expect(parsed.feedback).toMatchObject({
      target_type: "resource",
      target_id: "service/aws/textract",
      feedback_type: "stale",
      message: "The getting started guidance needs a new review.",
    });
    expect(parsed.feedback.id).toMatch(/^feedback-/);
  });

  it("returns structured invalid_request errors", async () => {
    const response = await handleFeedbackRequest({
      target_type: "resource",
      target_id: "",
      feedback_type: "stale",
      message: "",
    });

    expect(response.status).toBe(400);
    expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe("invalid_request");
  });

  it("returns structured not-found errors for unknown targets", async () => {
    const response = await handleFeedbackRequest({
      target_type: "resource",
      target_id: "service/aws/missing",
      feedback_type: "missing",
      message: "I expected this resource to exist.",
    });

    expect(response.status).toBe(404);
    expect(ApiErrorResponseSchema.parse(response.body).error.code).toBe("resource_not_found");
  });
});
