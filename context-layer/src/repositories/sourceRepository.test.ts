import { describe, expect, it } from "vitest";
import type { Source } from "@atlas/schema";
import { InMemorySourceRepository } from "./sourceRepository";

const source: Source = {
  id: "textract-module-readme",
  title: "Textract Terraform Module",
  source_class: "terraform-module",
  location: "example/textract/aws",
  visibility: "internal",
  authority_scope: ["module-usage", "private-networking"],
  authority_level: "authoritative",
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
