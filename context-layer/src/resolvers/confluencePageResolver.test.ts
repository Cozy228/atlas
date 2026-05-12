import { describe, expect, it } from "vitest";
import type { Anchor, Source } from "@atlas/schema";
import { confluencePageResolver } from "./confluencePageResolver.js";
import { createInMemorySourceContentProvider } from "./sourceContentProvider.js";

const source: Source = {
  id: "central-lz-confluence",
  title: "Central Landing Zone Guide",
  source_class: "confluence-page",
  location: "https://confluence.example.com/display/CLOUD/Central+Landing+Zone",
  steward: "cloud-foundation",
  visibility: "internal",
  authority_scope: ["landing-zone-guidance"],
  authority_level: "authoritative",
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-04-10T00:00:00.000Z",
  review_frequency: "P120D",
};

const anchor: Anchor = {
  id: "environment-matrix",
  source_id: "central-lz-confluence",
  anchor_strategy: "confluence-section",
  title: "Environment matrix",
  selector: { locator: "environment-matrix" },
  citation_label: "Environment matrix",
  status: "valid",
  last_validated_at: "2026-05-05T00:00:00.000Z",
};

describe("confluencePageResolver", () => {
  it("resolves a registered Confluence section", () => {
    const result = confluencePageResolver.resolve({
      source,
      anchors: [anchor],
      anchorId: "environment-matrix",
      contentProvider: createInMemorySourceContentProvider({
        "central-lz-confluence": {
          "environment-matrix": "Production and non-production accounts are separated.",
        },
      }),
    });

    expect(result.excerpts[0]?.text).toContain("Production");
    expect(result.warnings).toEqual([]);
  });

  it("returns broken_anchor when the section is absent", () => {
    const result = confluencePageResolver.resolve({
      source,
      anchors: [anchor],
      anchorId: "environment-matrix",
      contentProvider: createInMemorySourceContentProvider({
        "central-lz-confluence": {},
      }),
    });

    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });

  it("returns source_unavailable when the page cannot be fetched", () => {
    const result = confluencePageResolver.resolve({
      source,
      anchors: [anchor],
      anchorId: "environment-matrix",
      contentProvider: createInMemorySourceContentProvider({}),
    });

    expect(result.warnings[0]?.code).toBe("source_unavailable");
  });

  it("returns broken_anchor for malformed section input", () => {
    const result = confluencePageResolver.resolve({
      source,
      anchors: [
        {
          ...anchor,
          id: "bad",
          title: "Bad",
          selector: { locator: "#bad" },
          citation_label: "Bad",
        },
      ],
      anchorId: "bad",
      contentProvider: createInMemorySourceContentProvider({
        "central-lz-confluence": { "#bad": "Invalid locator." },
      }),
    });

    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });
});
