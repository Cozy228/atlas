import { describe, expect, it } from "vitest";
import {
  SourceDiscoveryResponseSchema,
  TopicDiscoveryResponseSchema,
} from "@atlas/schema";
import { handleSourceDiscoveryRequest } from "./sourceDiscoveryRoute.js";
import { handleTopicDiscoveryRequest } from "./topicDiscoveryRoute.js";

describe("discovery routes", () => {
  it("discovers sources by class through the shared response schema", () => {
    const response = handleSourceDiscoveryRequest({
      source_class: "terraform-module",
    });

    expect(response.status).toBe(200);
    expect(SourceDiscoveryResponseSchema.parse(response.body).sources.length).toBe(3);
  });

  it("discovers topics by type through the shared response schema", () => {
    const response = handleTopicDiscoveryRequest({
      topic_type: "landing-zone",
    });

    expect(response.status).toBe(200);
    expect(TopicDiscoveryResponseSchema.parse(response.body).topics.length).toBe(3);
  });
});
