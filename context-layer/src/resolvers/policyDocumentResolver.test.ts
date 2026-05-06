import { describe, expect, it } from "vitest";
import type { Source } from "@atlas/schema";
import { policyDocumentResolver } from "./policyDocumentResolver.js";
import { createInMemorySourceContentProvider } from "./sourceContentProvider.js";

const source: Source = {
  id: "s3-policy-doc",
  title: "S3 Security Policy",
  source_class: "policy-document",
  location: "s3://policy-docs/cloud/s3-security.md",
  steward: "cloud-security",
  visibility: "internal",
  authority_scope: ["security-guardrail"],
  authority_level: "authoritative",
  anchor_strategy: "document-clause",
  available_anchors: [
    {
      id: "public-access",
      label: "Public access controls",
      locator: "clause-2.1",
    },
  ],
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-04-01T00:00:00.000Z",
  review_frequency: "P90D",
};

describe("policyDocumentResolver", () => {
  it("resolves a registered policy clause", () => {
    const result = policyDocumentResolver.resolve({
      source,
      anchorId: "public-access",
      contentProvider: createInMemorySourceContentProvider({
        "s3-policy-doc": {
          "clause-2.1": "S3 buckets must block public access.",
        },
      }),
    });

    expect(result.excerpts[0]?.text).toBe("S3 buckets must block public access.");
    expect(result.warnings).toEqual([]);
  });

  it("returns broken_anchor when the clause is absent", () => {
    const result = policyDocumentResolver.resolve({
      source,
      anchorId: "public-access",
      contentProvider: createInMemorySourceContentProvider({
        "s3-policy-doc": {},
      }),
    });

    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });

  it("returns source_unavailable when the document cannot be fetched", () => {
    const result = policyDocumentResolver.resolve({
      source,
      anchorId: "public-access",
      contentProvider: createInMemorySourceContentProvider({}),
    });

    expect(result.warnings[0]?.code).toBe("source_unavailable");
  });

  it("returns broken_anchor for malformed clause input", () => {
    const result = policyDocumentResolver.resolve({
      source: {
        ...source,
        available_anchors: [{ id: "bad", label: "Bad", locator: "2.1" }],
      },
      anchorId: "bad",
      contentProvider: createInMemorySourceContentProvider({
        "s3-policy-doc": { "2.1": "Invalid locator." },
      }),
    });

    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });
});
