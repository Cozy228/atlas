import { describe, expect, it } from "vitest";
import type { Topic } from "@atlas/schema";

import type { AvailabilityRecord } from "@/api/server/availability";
import { findAvailabilityServiceForTopic } from "./availability-service";

const services = [
  { id: "textract", name: "Amazon Textract", iconKey: "TEX", domain: "AI", availability: {} },
  { id: "bedrock", name: "Amazon Bedrock", iconKey: "BDR", domain: "AI", availability: {} },
  { id: "lambda", name: "Lambda", iconKey: "LAM", domain: "Compute", availability: {} },
] as ReadonlyArray<AvailabilityRecord>;

function topic(id: string, name: string): Topic {
  return {
    id,
    name,
    topic_type: "service",
    category: "ai-ml",
    status: "active",
    description: "Test topic",
    owner_team: "cloud-platform",
    support_channel: "#cloud-platform",
    entry_tools: [],
  };
}

describe("findAvailabilityServiceForTopic", () => {
  it("maps seeded service topic IDs to AWS availability services", () => {
    expect(findAvailabilityServiceForTopic(topic("aws-textract", "AWS Textract"), services)?.id).toBe(
      "textract",
    );
    expect(findAvailabilityServiceForTopic(topic("aws-bedrock", "AWS Bedrock"), services)?.id).toBe(
      "bedrock",
    );
    expect(
      findAvailabilityServiceForTopic(topic("serverless-compute", "Serverless Compute"), services)
        ?.id,
    ).toBe("lambda");
  });
});
