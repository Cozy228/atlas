import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SourceDiscoveryResponseSchema, TopicDiscoveryResponseSchema } from "@atlas/schema";
import { setDevDiscoveryEnv } from "../devMocks";
import { handleSourceDiscoveryRequest } from "./sourceDiscoveryRoute";
import { handleTopicDiscoveryRequest } from "./topicDiscoveryRoute";

// Post-flip (plan 018 G5) the registry is the OUTPUT of live discovery, so point
// every channel at the MSW fixtures (the global devMocks/setup.ts keeps the
// Node-mode server listening); with no env the catalog is honest-empty.
const savedEnv = { ...process.env };
beforeAll(() => setDevDiscoveryEnv());
afterAll(() => {
  process.env = savedEnv;
});

describe("discovery routes", () => {
  it("discovers sources by class through the shared response schema", async () => {
    const response = await handleSourceDiscoveryRequest({
      source_class: "terraform-module",
    });

    expect(response.status).toBe(200);
    const sources = SourceDiscoveryResponseSchema.parse(response.body).sources;
    // Every discovered service is module-backed in the coherent fixture, so the
    // class filter returns one terraform-module source per service (N is data).
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => source.source_class === "terraform-module")).toBe(true);
  });

  it("discovers topics by type through the shared response schema", async () => {
    const response = await handleTopicDiscoveryRequest({
      topic_type: "security-policy",
    });

    expect(response.status).toBe(200);
    const topics = TopicDiscoveryResponseSchema.parse(response.body).topics;
    // The SECPOL space fixture carries four cross-cutting guardrails.
    expect(topics.length).toBe(4);
    expect(topics.every((topic) => topic.topic_type === "security-policy")).toBe(true);
  });
});
