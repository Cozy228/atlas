import { describe, expect, it } from "vitest";
import { ContextBundleResponseSchema } from "@atlas/schema";

describe("context layer contract boundary", () => {
  it("consumes the shared context bundle schema", () => {
    const bundle = ContextBundleResponseSchema.parse({
      bundle_id: "empty-context-layer-bundle",
      request: {
        topic_id: "unknown-topic",
      },
      sources: [],
      warnings: [],
      expansion_paths: [],
    });

    expect(bundle.sources).toEqual([]);
    expect(bundle.warnings).toEqual([]);
    expect(bundle.expansion_paths).toEqual([]);
  });
});
