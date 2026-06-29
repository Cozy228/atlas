import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Source } from "@atlas/schema";
import { confluencePageResolver } from "./confluencePageResolver";
import type { FetchLike } from "./resolverTypes";

const source: Source = {
  id: "central-lz-confluence",
  title: "Central Landing Zone Guide",
  source_class: "confluence-page",
  location: "123456",
  steward: "cloud-foundation",
  visibility: "internal",
  authority_scope: ["landing-zone-guidance"],
  authority_level: "authoritative",
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-04-10T00:00:00.000Z",
  review_frequency: "P120D",
};

/** A live Confluence Cloud v2 page response (storage body), as the API returns. */
function pageFetch(storageHtml: string, status = 200) {
  return vi.fn<FetchLike>(async () => ({
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return {
        version: { number: 3 },
        body: { storage: { value: storageHtml } },
        _links: { webui: "/spaces/CLOUD/pages/123456/Central" },
      };
    },
  }));
}

// Single live path (plan 018): the resolver always fetches from Confluence, so a
// base url must be configured for the live branch to engage. The injected `fetch`
// stands in for the network (unit-level); integration suites use MSW instead.
const savedBaseUrl = process.env.CONFLUENCE_BASE_URL;
beforeAll(() => {
  process.env.CONFLUENCE_BASE_URL = "https://example.atlassian.net";
});
afterAll(() => {
  if (savedBaseUrl === undefined) {
    delete process.env.CONFLUENCE_BASE_URL;
  } else {
    process.env.CONFLUENCE_BASE_URL = savedBaseUrl;
  }
});

describe("confluencePageResolver (single live path)", () => {
  it("resolves a registered Confluence section from the live page", async () => {
    const fetch = pageFetch(
      "<h2>Environment matrix</h2><p>Production and non-production accounts are separated.</p>",
    );
    const result = await confluencePageResolver.resolve({
      ctx: { token: "fictional-bearer-token", fetch },
      source,
      heading: "Environment matrix",
      citationLabel: "Environment matrix",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.excerpts[0]?.text).toContain("Production");
    expect(result.warnings).toEqual([]);
  });

  it("returns broken_anchor when the section heading is absent from the page", async () => {
    const fetch = pageFetch("<h2>Something else</h2><p>No matching heading here.</p>");
    const result = await confluencePageResolver.resolve({
      ctx: { token: "fictional-bearer-token", fetch },
      source,
      heading: "Environment matrix",
      citationLabel: "Environment matrix",
    });

    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });

  it("returns source_unavailable when the page cannot be fetched (404)", async () => {
    const fetch = pageFetch("", 404);
    const result = await confluencePageResolver.resolve({
      ctx: { token: "fictional-bearer-token", fetch },
      source,
      heading: "Environment matrix",
      citationLabel: "Environment matrix",
    });

    expect(result.warnings[0]?.code).toBe("source_unavailable");
  });

  it("returns broken_anchor when no section heading is supplied to locate", async () => {
    const fetch = pageFetch("<h2>Environment matrix</h2><p>Present, but unrequested.</p>");
    const result = await confluencePageResolver.resolve({
      ctx: { token: "fictional-bearer-token", fetch },
      source,
    });

    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });

  it("yields an honest source_unavailable gap when no token is configured, without fetching", async () => {
    const fetch = vi.fn<FetchLike>();
    const result = await confluencePageResolver.resolve({
      ctx: { token: undefined, fetch },
      source,
      heading: "Environment matrix",
      citationLabel: "Environment matrix",
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("source_unavailable");
  });
});
