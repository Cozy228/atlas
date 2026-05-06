import { describe, expect, it } from "vitest";
import type { Source } from "@atlas/schema";
import { createInMemorySourceContentProvider } from "./sourceContentProvider.js";
import { terraformModuleResolver } from "./terraformModuleResolver.js";

const source: Source = {
  id: "textract-module-readme",
  title: "Textract Terraform Module",
  source_class: "terraform-module",
  location: "github.com/acme/terraform-aws-textract",
  steward: "cloud-platform",
  visibility: "internal",
  authority_scope: ["module-usage"],
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

describe("terraformModuleResolver", () => {
  it("resolves a registered markdown heading anchor", () => {
    const result = terraformModuleResolver.resolve({
      source,
      anchorId: "private-subnet-usage",
      contentProvider: createInMemorySourceContentProvider({
        "textract-module-readme": {
          "#private-subnet-usage": "Use the private endpoint configuration.",
        },
      }),
    });

    expect(result.excerpts[0]?.citation).toEqual({
      source_id: "textract-module-readme",
      anchor_id: "private-subnet-usage",
      label: "Private subnet usage",
      location: "github.com/acme/terraform-aws-textract#private-subnet-usage",
    });
    expect(result.warnings).toEqual([]);
  });

  it("returns a broken anchor warning for missing markdown content", () => {
    const result = terraformModuleResolver.resolve({
      source,
      anchorId: "private-subnet-usage",
      contentProvider: createInMemorySourceContentProvider({
        "textract-module-readme": {},
      }),
    });

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]).toMatchObject({
      code: "broken_anchor",
      source_id: "textract-module-readme",
      anchor_id: "private-subnet-usage",
    });
  });

  it("returns source_unavailable when module content cannot be fetched", () => {
    const result = terraformModuleResolver.resolve({
      source,
      anchorId: "private-subnet-usage",
      contentProvider: createInMemorySourceContentProvider({}),
    });

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]).toMatchObject({
      code: "source_unavailable",
      source_id: "textract-module-readme",
    });
  });

  it("returns broken_anchor for malformed markdown anchor input", () => {
    const result = terraformModuleResolver.resolve({
      source: {
        ...source,
        available_anchors: [
          {
            id: "private-subnet-usage",
            label: "Private subnet usage",
            locator: "private-subnet-usage",
          },
        ],
      },
      anchorId: "private-subnet-usage",
      contentProvider: createInMemorySourceContentProvider({
        "textract-module-readme": {
          "private-subnet-usage": "This should not be accepted.",
        },
      }),
    });

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });
});
