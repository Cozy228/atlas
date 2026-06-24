import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { loadGuidance } from "./loadGuidance";
import { buildSitemapXml } from "./agentDiscovery";
import { serverContextApiClient } from "./serverContextApiClient";

const PUBLIC_DIR = fileURLToPath(new URL("../../../public/", import.meta.url));

describe("robots.txt", () => {
  const robots = readFileSync(`${PUBLIC_DIR}robots.txt`, "utf8");

  it("carries the sitemap and content-signal lines", () => {
    expect(robots).toContain("Sitemap: https://portal.example.com/sitemap.xml");
    expect(robots).toContain("Content-Signal: ai-train=no, search=no, ai-input=yes");
  });

  it("allows the browse surfaces and disallows the chat and mutation paths", () => {
    for (const path of ["/catalog/", "/sources/", "/guidance/", "/llms.txt", "/.well-known/"]) {
      expect(robots).toContain(`Allow: ${path}`);
    }
    expect(robots).toContain("Disallow: /ask");
  });
});

describe("sitemap.xml", () => {
  it("is a valid urlset of canonical pages, excluding mutation flows and the Ask chat", async () => {
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
      expect(loc).not.toContain("/ask");
      expect(loc).not.toContain("/api/");
      expect(loc).not.toContain("/feedback");
    }
    expect(locs).toContain("https://portal.example.com/catalog/aws-textract");
    expect(locs).toContain("https://portal.example.com/sources/textract-module-readme");
  });
});

describe("oauth-protected-resource", () => {
  it("is generic and fabricates no scopes", () => {
    const metadata = JSON.parse(
      readFileSync(`${PUBLIC_DIR}.well-known/oauth-protected-resource`, "utf8"),
    ) as Record<string, unknown>;
    expect(metadata.resource).toBe("https://portal.example.com");
    expect(metadata.bearer_methods_supported).toEqual(["header"]);
    // The Bearer pipe (ADR 0001) defines no OAuth scopes — none may be advertised.
    expect(metadata.scopes_supported).toBeUndefined();
    expect(metadata.authorization_servers).toBeUndefined();
  });
});
