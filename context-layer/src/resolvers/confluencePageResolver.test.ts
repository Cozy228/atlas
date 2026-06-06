import { describe, expect, it, vi } from "vitest";
import type { Anchor, Source } from "@atlas/schema";
import { confluencePageResolver } from "./confluencePageResolver.js";
import { offlineResolutionContext, type FetchLike } from "./resolverTypes.js";
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
  it("resolves a registered Confluence section", async () => {
    const result = await confluencePageResolver.resolve({
      ctx: offlineResolutionContext(),
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

  it("returns broken_anchor when the section is absent", async () => {
    const result = await confluencePageResolver.resolve({
      ctx: offlineResolutionContext(),
      source,
      anchors: [anchor],
      anchorId: "environment-matrix",
      contentProvider: createInMemorySourceContentProvider({
        "central-lz-confluence": {},
      }),
    });

    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });

  it("returns source_unavailable when the page cannot be fetched", async () => {
    const result = await confluencePageResolver.resolve({
      ctx: offlineResolutionContext(),
      source,
      anchors: [anchor],
      anchorId: "environment-matrix",
      contentProvider: createInMemorySourceContentProvider({}),
    });

    expect(result.warnings[0]?.code).toBe("source_unavailable");
  });

  it("returns broken_anchor for malformed section input", async () => {
    const result = await confluencePageResolver.resolve({
      ctx: offlineResolutionContext(),
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

  it("falls back to the pilot provider offline (no token, no base url) without fetching", async () => {
    const fetch = vi.fn<FetchLike>();

    const result = await confluencePageResolver.resolve({
      ctx: { token: undefined, fetch },
      source,
      anchors: [anchor],
      anchorId: "environment-matrix",
      contentProvider: createInMemorySourceContentProvider({
        "central-lz-confluence": {
          "environment-matrix": "Production and non-production accounts are separated.",
        },
      }),
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.excerpts[0]?.text).toContain("Production");
    expect(result.warnings).toEqual([]);
  });

  it("takes the live branch when a token and base url are configured", async () => {
    const env = (
      globalThis as typeof globalThis & {
        process: { env: Record<string, string | undefined> };
      }
    ).process.env;
    const previousBaseUrl = env.ATLAS_CONFLUENCE_BASE_URL;
    env.ATLAS_CONFLUENCE_BASE_URL = "https://example.atlassian.net";

    const fetch = vi.fn<FetchLike>(async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          version: { number: 3 },
          body: {
            storage: {
              value: "<h2>Environment matrix</h2><p>Live separation of accounts.</p>",
            },
          },
          _links: { webui: "/spaces/CLOUD/pages/123456/Central" },
        };
      },
    }));

    const result = await confluencePageResolver.resolve({
      ctx: { token: "fictional-bearer-token", fetch },
      source: { ...source, location: "123456" },
      anchors: [anchor],
      anchorId: "environment-matrix",
      contentProvider: createInMemorySourceContentProvider({}),
    });

    if (previousBaseUrl === undefined) {
      delete env.ATLAS_CONFLUENCE_BASE_URL;
    } else {
      env.ATLAS_CONFLUENCE_BASE_URL = previousBaseUrl;
    }

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.excerpts[0]?.text).toContain("Live separation of accounts.");
  });
});
