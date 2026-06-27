import { describe, expect, it } from "vitest";

import { loadGuidance } from "../../adapters/dev/loadGuidance";
import { buildOauthProtectedResource, buildRobotsTxt, buildSitemapXml } from "./agentDiscovery";
import { serverContextApiClient } from "./serverContextApiClient";

describe("robots.txt", () => {
  const robots = buildRobotsTxt();

  it("carries the sitemap and content-signal lines", () => {
    expect(robots).toContain("Sitemap: https://portal.example.com/sitemap.xml");
    expect(robots).toContain("Content-Signal: ai-train=no, search=no, ai-input=yes");
  });

  it("allows the browse surfaces and disallows the support page and mutation paths", () => {
    for (const path of ["/catalog/", "/sources/", "/guidance/", "/llms.txt", "/.well-known/"]) {
      expect(robots).toContain(`Allow: ${path}`);
    }
    expect(robots).toContain("Disallow: /support");
  });
});

describe("sitemap.xml", () => {
  it("is a valid urlset of canonical pages, excluding mutation flows and the support page", async () => {
    const [topics, sources] = await Promise.all([
      serverContextApiClient.discoverTopics(),
      serverContextApiClient.discoverSources(),
    ]);
    const xml = buildSitemapXml({
      topicIds: topics.topics.map((topic) => topic.id),
      sourceIds: sources.sources.map((source) => source.id),
      guidanceIds: loadGuidance().map((guidance) => guidance.id),
    });

    expect(xml).toMatch(
      /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/,
    );
    expect(xml.trimEnd().endsWith("</urlset>")).toBe(true);

    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
    expect(locs.length).toBeGreaterThan(10);
    for (const loc of locs) {
      expect(loc.startsWith("https://portal.example.com/")).toBe(true);
      expect(loc).not.toContain("/support");
      expect(loc).not.toContain("/api/");
      expect(loc).not.toContain("/feedback");
    }
    expect(locs).toContain("https://portal.example.com/catalog/aws-textract");
    expect(locs).toContain("https://portal.example.com/sources/textract-module-readme");
  });
});

describe("oauth-protected-resource", () => {
  it("is generic and fabricates no scopes", () => {
    const metadata = buildOauthProtectedResource() as Record<string, unknown>;
    expect(metadata.resource).toBe("https://portal.example.com");
    expect(metadata.bearer_methods_supported).toEqual(["header"]);
    // The Bearer pipe (ADR 0001) defines no OAuth scopes — none may be advertised.
    expect(metadata.scopes_supported).toBeUndefined();
    expect(metadata.authorization_servers).toBeUndefined();
  });
});
