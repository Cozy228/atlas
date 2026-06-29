import { describe, expect, it } from "vitest";
import { TopicDiscoveryResponseSchema } from "@atlas/schema";
import { handler } from "./handler";

describe("context API Lambda handler", () => {
  it("adapts API Gateway HTTP API events to HTTP route responses", async () => {
    const response = await handler({
      version: "2.0",
      routeKey: "GET /topics",
      rawPath: "/topics",
      rawQueryString: "topic_type=security-policy",
      headers: {},
      requestContext: { http: { method: "GET", path: "/topics" } },
      isBase64Encoded: false,
    });

    expect(response.statusCode).toBe(200);
    const body = TopicDiscoveryResponseSchema.parse(JSON.parse(response.body));
    expect(body.topics.every((topic) => topic.topic_type === "security-policy")).toBe(true);
  });
});
