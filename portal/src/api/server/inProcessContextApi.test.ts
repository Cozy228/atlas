import { describe, expect, it } from "vitest";

import { serverContextApiClient } from "./inProcessContextApi";

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
        ["service", "landing-zone", "security-policy"].includes(topic.topic_type),
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

  it("projects a configured service with governance + reference-only links (plan 017)", async () => {
    const projection = await serverContextApiClient.getResourceContext("service", "aws/textract");

    expect(projection.resource.id).toBe("service/aws/textract");
    expect(projection.governance).toBe("configured");
    expect(projection.references.length).toBeGreaterThan(0);
    // Every link is honestly reference-only — the agent/UI never reads the body.
    for (const reference of projection.references) {
      expect(reference.content_mode).toBe("reference_only");
      expect(reference.agent_accessible).toBe(false);
    }
  });

  it("projects a spine-only service as governance:unconfigured, not a 404", async () => {
    const projection = await serverContextApiClient.getResourceContext("service", "aws/s3");

    expect(projection.governance).toBe("unconfigured");
    expect(projection.sections).toEqual({});
    expect(projection.referenceDiscovery?.status).toBe("fresh");
  });

  it("throws resource_not_found for a service that is neither spined nor overlaid", async () => {
    await expect(
      serverContextApiClient.getResourceContext("service", "aws/not-a-real-service"),
    ).rejects.toMatchObject({ name: "ContextApiError", code: "resource_not_found", status: 404 });
  });
});
