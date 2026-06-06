import { describe, expect, it } from "vitest";
import type { Anchor, Source } from "@atlas/schema";
import { policyDocumentResolver } from "./policyDocumentResolver.js";
import { offlineResolutionContext } from "./resolverTypes.js";
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
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-04-01T00:00:00.000Z",
  review_frequency: "P90D",
};

const anchor: Anchor = {
  id: "public-access",
  source_id: "s3-policy-doc",
  anchor_strategy: "document-clause",
  title: "Public access controls",
  selector: { locator: "clause-2.1" },
  citation_label: "Public access controls",
  status: "valid",
  last_validated_at: "2026-05-05T00:00:00.000Z",
};

describe("policyDocumentResolver", () => {
  it("resolves a registered policy clause", async () => {
    const result = await policyDocumentResolver.resolve({
      ctx: offlineResolutionContext(),
      source,
      anchors: [anchor],
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

  it("returns broken_anchor when the clause is absent", async () => {
    const result = await policyDocumentResolver.resolve({
      ctx: offlineResolutionContext(),
      source,
      anchors: [anchor],
      anchorId: "public-access",
      contentProvider: createInMemorySourceContentProvider({
        "s3-policy-doc": {},
      }),
    });

    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });

  it("returns source_unavailable when the document cannot be fetched", async () => {
    const result = await policyDocumentResolver.resolve({
      ctx: offlineResolutionContext(),
      source,
      anchors: [anchor],
      anchorId: "public-access",
      contentProvider: createInMemorySourceContentProvider({}),
    });

    expect(result.warnings[0]?.code).toBe("source_unavailable");
  });

  it("returns broken_anchor for malformed clause input", async () => {
    const result = await policyDocumentResolver.resolve({
      ctx: offlineResolutionContext(),
      source,
      anchors: [
        {
          ...anchor,
          id: "bad",
          title: "Bad",
          selector: { locator: "2.1" },
          citation_label: "Bad",
        },
      ],
      anchorId: "bad",
      contentProvider: createInMemorySourceContentProvider({
        "s3-policy-doc": { "2.1": "Invalid locator." },
      }),
    });

    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });
});
