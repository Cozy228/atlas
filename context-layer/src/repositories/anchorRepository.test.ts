import { describe, expect, it } from "vitest";
import type { Anchor } from "@atlas/schema";
import { InMemoryAnchorRepository } from "./anchorRepository";

const anchor: Anchor = {
  id: "textract-private-subnet",
  source_id: "textract-module-readme",
  anchor_strategy: "markdown-heading",
  title: "Private subnet usage",
  selector: {
    locator: "#private-subnet-usage",
  },
  citation_label: "Private subnet usage",
  status: "valid",
  last_validated_at: "2026-05-05T00:00:00.000Z",
};

describe("InMemoryAnchorRepository", () => {
  it("creates and retrieves anchor records independently from sources", () => {
    const repository = new InMemoryAnchorRepository();

    repository.put(anchor);

    expect(repository.getById("textract-private-subnet")).toEqual(anchor);
    expect(repository.findBySourceId("textract-module-readme")).toEqual([anchor]);
  });

  it("rejects malformed anchor records", () => {
    const repository = new InMemoryAnchorRepository();

    expect(() =>
      repository.put({
        ...anchor,
        status: "missing",
      }),
    ).toThrow();
  });
});
