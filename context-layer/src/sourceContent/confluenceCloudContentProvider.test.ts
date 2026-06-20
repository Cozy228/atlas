import { describe, expect, it, vi } from "vitest";
import type { Anchor, Source } from "@atlas/schema";
import { resolveConfluencePageLive } from "./confluenceCloudContentProvider.js";
import type { FetchLike } from "../resolvers/resolverTypes.js";

const source: Source = {
  id: "central-lz-confluence",
  title: "Central Landing Zone Guide",
  source_class: "confluence-page",
  // For the live path, location is the Confluence page id.
  location: "123456",
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

const config = {
  token: "fictional-bearer-token",
  baseUrl: "https://example.atlassian.net",
};

const pageHtml = [
  "<h2>Overview</h2>",
  "<p>General landing zone overview.</p>",
  "<h2>Environment matrix</h2>",
  "<p>Production and non-production accounts are separated.</p>",
  "<p>Each environment has its own guardrails.</p>",
  "<h2>Next steps</h2>",
  "<p>Review the onboarding checklist.</p>",
].join("");

function jsonFetch(body: unknown, status = 200): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fetch: FetchLike = vi.fn(async (input: string, init) => {
    calls.push(init?.headers?.Authorization ?? "");
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return body;
      },
    };
  });
  return { fetch, calls };
}

describe("resolveConfluencePageLive", () => {
  it("resolves a known page + anchor into an excerpt with a clickable citation", async () => {
    const { fetch, calls } = jsonFetch({
      title: "Central Landing Zone Guide",
      version: { number: 7 },
      body: { storage: { value: pageHtml } },
      _links: { webui: "/spaces/CLOUD/pages/123456/Central+Landing+Zone" },
    });

    const result = await resolveConfluencePageLive(
      {
        source,
        anchors: [anchor],
        anchorId: "environment-matrix",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    expect(result.warnings).toEqual([]);
    expect(result.excerpts[0]?.text).toContain(
      "Production and non-production accounts are separated.",
    );
    expect(result.excerpts[0]?.text).toContain("Each environment has its own guardrails.");
    // Section ends at the next heading.
    expect(result.excerpts[0]?.text).not.toContain("onboarding checklist");
    expect(result.excerpts[0]?.citation.location).toBe(
      "https://example.atlassian.net/spaces/CLOUD/pages/123456/Central+Landing+Zone#environment-matrix",
    );
    // The opaque caller Bearer was threaded to Confluence.
    expect(calls[0]).toBe("Bearer fictional-bearer-token");
  });

  it("maps 401/403 to a restricted_source warning, not content", async () => {
    const { fetch } = jsonFetch({}, 403);

    const result = await resolveConfluencePageLive(
      {
        source,
        anchors: [anchor],
        anchorId: "environment-matrix",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("restricted_source");
  });

  it("maps 404 to source_unavailable", async () => {
    const { fetch } = jsonFetch({}, 404);

    const result = await resolveConfluencePageLive(
      {
        source,
        anchors: [anchor],
        anchorId: "environment-matrix",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    expect(result.warnings[0]?.code).toBe("source_unavailable");
  });

  it("maps a missing anchor heading to broken_anchor", async () => {
    const { fetch } = jsonFetch({
      version: { number: 7 },
      body: { storage: { value: "<h2>Overview</h2><p>Only an overview here.</p>" } },
      _links: { webui: "/spaces/CLOUD/pages/123456/Central+Landing+Zone" },
    });

    const result = await resolveConfluencePageLive(
      {
        source,
        anchors: [anchor],
        anchorId: "environment-matrix",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });

  it("maps a matched-but-empty heading to broken_anchor", async () => {
    const { fetch } = jsonFetch({
      version: { number: 7 },
      body: { storage: { value: "<h2>Environment matrix</h2><h2>Next steps</h2><p>More.</p>" } },
      _links: { webui: "/spaces/CLOUD/pages/123456/Central+Landing+Zone" },
    });

    const result = await resolveConfluencePageLive(
      {
        source,
        anchors: [anchor],
        anchorId: "environment-matrix",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });

  it("emits stale_source when the live version exceeds observed_version", async () => {
    const { fetch } = jsonFetch({
      version: { number: 9 },
      body: { storage: { value: pageHtml } },
      _links: { webui: "/spaces/CLOUD/pages/123456/Central+Landing+Zone" },
    });

    const result = await resolveConfluencePageLive(
      {
        source: { ...source, observed_version: 7 },
        anchors: [anchor],
        anchorId: "environment-matrix",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    // Drift is non-fatal: the excerpt still resolves.
    expect(result.excerpts).toHaveLength(1);
    const drift = result.warnings.find((warning) => warning.code === "stale_source");
    expect(drift?.message).toBe("Source has changed since registration.");
  });

  it("does not emit drift when there is no recorded observed_version", async () => {
    const { fetch } = jsonFetch({
      version: { number: 9 },
      body: { storage: { value: pageHtml } },
      _links: { webui: "/spaces/CLOUD/pages/123456/Central+Landing+Zone" },
    });

    const result = await resolveConfluencePageLive(
      {
        source,
        anchors: [anchor],
        anchorId: "environment-matrix",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    expect(result.warnings).toEqual([]);
  });

  it("falls back to the page id for the citation when no webui link is present", async () => {
    const { fetch } = jsonFetch({
      version: { number: 7 },
      body: { storage: { value: pageHtml } },
    });

    const result = await resolveConfluencePageLive(
      {
        source,
        anchors: [anchor],
        anchorId: "environment-matrix",
        ctx: { token: config.token, fetch },
      },
      config,
    );

    expect(result.excerpts[0]?.citation.location).toBe(
      "https://example.atlassian.net/wiki/pages/123456#environment-matrix",
    );
  });

  it("uses Basic auth (email:token) for a Confluence Cloud personal API token", async () => {
    const { fetch, calls } = jsonFetch({
      version: { number: 7 },
      body: { storage: { value: pageHtml } },
      _links: { webui: "/spaces/CLOUD/pages/123456/Central" },
    });

    await resolveConfluencePageLive(
      {
        source,
        anchors: [anchor],
        anchorId: "environment-matrix",
        ctx: { token: "api-token", fetch },
      },
      { ...config, token: "api-token", email: "dev@example.com" },
    );

    const expected = `Basic ${Buffer.from("dev@example.com:api-token").toString("base64")}`;
    expect(calls[0]).toBe(expected);
  });
});
