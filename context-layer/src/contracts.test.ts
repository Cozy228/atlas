import { describe, expect, it } from "vitest";
import { ResourceContextResponseSchema } from "@atlas/schema";

describe("context layer contract boundary", () => {
  it("consumes the shared resource projection schema", () => {
    const projection = ResourceContextResponseSchema.parse({
      resource: {
        kind: "service",
        id: "service/aws/textract",
        slug: "aws/textract",
        name: "Amazon Textract",
        aliases: [],
        resourceUrl: "/api/resources/service/aws/textract",
        markdownUrl: "/resources/service/aws/textract.md",
      },
      governance: "unconfigured",
      requestedSections: [],
      sections: {},
      missingSections: [],
      references: [],
      referenceDiscovery: null,
      resolvedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(projection.sections).toEqual({});
    expect(projection.missingSections).toEqual([]);
    expect(projection.governance).toBe("unconfigured");
  });
});
