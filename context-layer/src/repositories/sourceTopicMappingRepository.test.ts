import { describe, expect, it } from "vitest";
import type { SourceTopicMapping } from "@atlas/schema";
import { InMemorySourceTopicMappingRepository } from "./sourceTopicMappingRepository.js";

const mapping: SourceTopicMapping = {
  id: "textract-module-to-topic",
  source_id: "textract-module-readme",
  topic_id: "aws-textract",
};

describe("InMemorySourceTopicMappingRepository", () => {
  it("creates and retrieves mapping records independently", () => {
    const repository = new InMemorySourceTopicMappingRepository();

    repository.put(mapping);

    expect(repository.getById("textract-module-to-topic")).toEqual(mapping);
    expect(repository.getById("missing-mapping")).toBeUndefined();
  });

  it("queries mappings by source and topic", () => {
    const repository = new InMemorySourceTopicMappingRepository([mapping]);

    expect(repository.findByTopicId("aws-textract")).toEqual([mapping]);
    expect(repository.findBySourceId("textract-module-readme")).toEqual([mapping]);
    expect(repository.findByTopicId("central-landing-zone")).toEqual([]);
  });

  it("rejects mapping records with governance metadata", () => {
    const repository = new InMemorySourceTopicMappingRepository();

    expect(() =>
      repository.put({
        ...mapping,
        authority_level: "authoritative",
      }),
    ).toThrow();
  });
});
