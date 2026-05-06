import { describe, expect, it } from "vitest";

import { ContextApiError } from "../contextApiError.js";
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
    try {
      await serverContextApiClient.getContextBundle({
        source_id: "regulated-lz-confluence",
      });
      throw new Error("expected the call to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ContextApiError);
      const apiError = error as ContextApiError;
      expect(apiError.code).toBe("access_denied");
      expect(apiError.status).toBe(403);
    }
  });

  it("returns the registered topics, parsed through the shared schema", async () => {
    const response = await serverContextApiClient.discoverTopics();
    expect(response.topics.length).toBeGreaterThan(0);
    expect(
      response.topics.every((topic) =>
        ["capability", "landing-zone", "guardrail-area"].includes(
          topic.topic_type,
        ),
      ),
    ).toBe(true);
  });

  it("returns the registered sources, parsed through the shared schema", async () => {
    const response = await serverContextApiClient.discoverSources();
    expect(response.sources.length).toBeGreaterThan(0);
    expect(response.sources.every((source) => source.id.length > 0)).toBe(
      true,
    );
  });
});
