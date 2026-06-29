import { describe, expect, it } from "vitest";
import { FeedbackResponseSchema, TopicDiscoveryResponseSchema } from "@atlas/schema";
import { handleHttpRequest } from "./httpRoute";

describe("context API HTTP route adapter", () => {
  it("maps GET /topics query parameters to topic discovery", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/topics",
      query: { topic_type: "service" },
    });

    expect(response.status).toBe(200);
    const body = TopicDiscoveryResponseSchema.parse(JSON.parse(response.body));
    expect(body.topics.every((topic) => topic.topic_type === "service")).toBe(true);
  });

  it("maps API Gateway /api-prefixed routes to the same HTTP adapter", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/api/topics",
      query: { topic_type: "security-policy" },
    });

    expect(response.status).toBe(200);
    const body = TopicDiscoveryResponseSchema.parse(JSON.parse(response.body));
    expect(body.topics.every((topic) => topic.topic_type === "security-policy")).toBe(true);
  });

  it("maps POST /feedback to feedback submission", async () => {
    const response = await handleHttpRequest({
      method: "POST",
      path: "/feedback",
      body: JSON.stringify({
        target_type: "topic",
        target_id: "aws-textract",
        feedback_type: "unclear",
        message: "Clarify private subnet guidance.",
      }),
    });

    expect(response.status).toBe(201);
    const body = FeedbackResponseSchema.parse(JSON.parse(response.body));
    expect(body.feedback.target_id).toBe("aws-textract");
  });

  it("returns structured errors for unknown HTTP routes", async () => {
    const response = await handleHttpRequest({
      method: "GET",
      path: "/missing",
    });

    expect(response.status).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      error: {
        code: "invalid_request",
        message: "Route was not found.",
      },
    });
  });
});
