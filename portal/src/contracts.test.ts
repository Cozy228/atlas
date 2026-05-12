import { describe, expect, it } from "vitest";
import { ContextBundleResponseSchema } from "@atlas/schema";

describe("portal contract boundary", () => {
  it("consumes the shared context bundle schema", () => {
    const bundle = ContextBundleResponseSchema.parse({
      bundle_id: "empty-portal-bundle",
      request: {
        topic_id: "unknown-topic",
      },
      sources: [],
      anchor_references: [],
      warnings: [],
      expansion_paths: [],
    });

    expect(bundle.sources).toEqual([]);
    expect(bundle.anchor_references).toEqual([]);
    expect(bundle.warnings).toEqual([]);
    expect(bundle.expansion_paths).toEqual([]);
  });
});
