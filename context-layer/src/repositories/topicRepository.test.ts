import { describe, expect, it } from "vitest";
import type { Topic } from "@atlas/schema";
import { InMemoryTopicRepository } from "./topicRepository";

const topic: Topic = {
  id: "aws-textract",
  name: "AWS Textract",
  topic_type: "service",
  category: "ai-ml",
  status: "active",
  description: "Managed OCR service for document workflows.",
  owner_team: "cloud-platform",
  support_channel: "#cloud-platform",
  entry_tools: [
    {
      label: "Terraform module",
      url: "https://tfe.example.com/app/example/registry/modules/private/example/textract/aws",
    },
  ],
};

describe("InMemoryTopicRepository", () => {
  it("creates and retrieves topic records independently", () => {
    const repository = new InMemoryTopicRepository();

    repository.put(topic);

    expect(repository.getById("aws-textract")).toEqual(topic);
    expect(repository.getById("missing-topic")).toBeUndefined();
  });

  it("queries topics by type and category without source embedding", () => {
    const repository = new InMemoryTopicRepository([topic]);

    expect(repository.findByType("service")).toEqual([topic]);
    expect(repository.findByCategory("ai-ml")).toEqual([topic]);
    expect(repository.findByType("security-policy")).toEqual([]);
    expect(repository.getById("aws-textract")).not.toHaveProperty("source_ids");
  });

  it("rejects malformed topic records", () => {
    const repository = new InMemoryTopicRepository();

    expect(() =>
      repository.put({
        ...topic,
        topic_type: "invalid-type",
      }),
    ).toThrow();
  });
});
