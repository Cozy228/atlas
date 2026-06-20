import { describe, expect, it } from "vitest";

import { serverContextApiClient } from "./inProcessContextApi.js";

describe("serverContextApiClient", () => {
  it("returns a parsed context bundle for a known topic", async () => {
    const bundle = await serverContextApiClient.getContextBundle({
      topic_id: "aws-textract",
    });

    expect(bundle.bundle_id).toBeTypeOf("string");
    expect(bundle.sources.length).toBeGreaterThan(0);
    expect(bundle.sources[0]?.source.title).toContain("Textract");
  });

  it("throws a ContextApiError with topic_not_found for an unknown topic", async () => {
    await expect(
      serverContextApiClient.getContextBundle({
        topic_id: "does-not-exist",
      }),
    ).rejects.toMatchObject({
      name: "ContextApiError",
      code: "topic_not_found",
      status: 404,
    });
  });

  it("throws a ContextApiError with access_denied for a restricted source", async () => {
    await expect(
      serverContextApiClient.getContextBundle({
        source_id: "regulated-lz-confluence",
      }),
    ).rejects.toMatchObject({
      name: "ContextApiError",
      code: "access_denied",
      status: 403,
    });
  });

  it("returns the registered topics, parsed through the shared schema", async () => {
    const response = await serverContextApiClient.discoverTopics();
    expect(response.topics.length).toBeGreaterThan(0);
    expect(
      response.topics.every((topic) =>
        ["service", "landing-zone", "guardrail-area"].includes(topic.topic_type),
      ),
    ).toBe(true);
  });

  it("returns the registered sources, parsed through the shared schema", async () => {
    const response = await serverContextApiClient.discoverSources();
    expect(response.sources.length).toBeGreaterThan(0);
    expect(response.sources.every((source) => source.id.length > 0)).toBe(true);
  });

  it("submits feedback through the shared Context API contract", async () => {
    const response = await serverContextApiClient.submitFeedback({
      target_type: "topic",
      target_id: "aws-textract",
      feedback_type: "stale",
      message: "The getting started guidance needs a new review.",
    });

    expect(response.feedback.target_id).toBe("aws-textract");
    expect(response.feedback.id).toMatch(/^feedback-/);
  });
});
