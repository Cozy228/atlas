import { describe, expect, it } from "vitest";
import type { Source } from "@atlas/schema";
import { InMemorySourceRepository } from "./sourceRepository.js";

const source: Source = {
  id: "textract-module-readme",
  title: "Textract Terraform Module",
  source_class: "terraform-module",
  location: "github.com/acme/terraform-aws-textract",
  steward: "cloud-platform",
  visibility: "internal",
  authority_scope: ["module-usage", "private-networking"],
  authority_level: "authoritative",
  anchor_strategy: "markdown-heading",
  available_anchors: [
    {
      id: "private-subnet-usage",
      label: "Private subnet usage",
      locator: "#private-subnet-usage",
    },
  ],
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-05-01T00:00:00.000Z",
  review_frequency: "P90D",
};

describe("InMemorySourceRepository", () => {
  it("creates and retrieves source records independently", () => {
    const repository = new InMemorySourceRepository();

    repository.put(source);

    expect(repository.getById("textract-module-readme")).toEqual(source);
    expect(repository.getById("missing-source")).toBeUndefined();
  });

  it("queries sources by authority scope without topic embedding", () => {
    const repository = new InMemorySourceRepository([source]);

    const matches = repository.findByAuthorityScope("private-networking");

    expect(matches).toEqual([source]);
    expect(matches[0]).not.toHaveProperty("topic_ids");
  });

  it("rejects malformed source records", () => {
    const repository = new InMemorySourceRepository();

    expect(() =>
      repository.put({
        ...source,
        authority_level: "preferred",
      }),
    ).toThrow();
  });
});
