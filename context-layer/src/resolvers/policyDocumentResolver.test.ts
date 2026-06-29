import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Source } from "@atlas/schema";
import { policyDocumentResolver } from "./policyDocumentResolver";
import type { FetchLike } from "./resolverTypes";

const source: Source = {
  id: "s3-policy-doc",
  title: "S3 Security Policy",
  source_class: "policy-document",
  // For the single-live path, location is the Confluence page id.
  location: "300001",
  steward: "cloud-security",
  visibility: "internal",
  authority_scope: ["security-guardrail"],
  authority_level: "authoritative",
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-04-01T00:00:00.000Z",
  review_frequency: "P90D",
};

/** A live Confluence Cloud v2 page response (storage body), as the API returns. */
function pageFetch(storageHtml: string, status = 200) {
  return vi.fn<FetchLike>(async () => ({
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return {
        version: { number: 4 },
        body: { storage: { value: storageHtml } },
        _links: { webui: "/spaces/CLOUD/pages/300001/S3+Security+Policy" },
      };
    },
  }));
}

// Single live path (plan 018 G4): the policy resolver always fetches from
// Confluence, so a base url must be configured for the live branch to engage. The
// injected `fetch` stands in for the network (unit-level); integration suites use MSW.
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

describe("policyDocumentResolver (single live path)", () => {
  it("resolves a registered policy section from the live Confluence page", async () => {
    const fetch = pageFetch(
      "<h2>Public access controls</h2><p>S3 buckets must block public access.</p>",
    );
    const result = await policyDocumentResolver.resolve({
      ctx: { token: "fictional-bearer-token", fetch },
      source,
      heading: "Public access controls",
      citationLabel: "Public access controls",
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.excerpts[0]?.text).toContain("block public access");
    expect(result.warnings).toEqual([]);
  });

  it("returns broken_anchor when the section heading is absent from the page", async () => {
    const fetch = pageFetch("<h2>Something else</h2><p>No matching heading here.</p>");
    const result = await policyDocumentResolver.resolve({
      ctx: { token: "fictional-bearer-token", fetch },
      source,
      heading: "Public access controls",
      citationLabel: "Public access controls",
    });

    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });

  it("returns source_unavailable when the page cannot be fetched (404)", async () => {
    const fetch = pageFetch("", 404);
    const result = await policyDocumentResolver.resolve({
      ctx: { token: "fictional-bearer-token", fetch },
      source,
      heading: "Public access controls",
      citationLabel: "Public access controls",
    });

    expect(result.warnings[0]?.code).toBe("source_unavailable");
  });

  it("yields an honest source_unavailable gap when no token is configured, without fetching", async () => {
    const fetch = vi.fn<FetchLike>();
    const result = await policyDocumentResolver.resolve({
      ctx: { token: undefined, fetch },
      source,
      heading: "Public access controls",
      citationLabel: "Public access controls",
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("source_unavailable");
  });
});
