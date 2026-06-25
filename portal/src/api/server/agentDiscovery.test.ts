import { describe, expect, it } from "vitest";

import { buildApiCatalog, buildHomeLinkHeader, buildLlmsTxt } from "./agentDiscovery";

/** Routes the Portal origin actually serves (static files or server routes). */
const REAL_ROUTES = new Set([
  "/openapi.json",
  "/llms.txt",
  "/health",
  "/mcp",
  "/sitemap.xml",
  "/.well-known/api-catalog",
  "/.well-known/agent-skills/index.json",
  "/catalog",
  "/sources",
  "/guidance",
]);

function assertRealRoute(href: string) {
  const url = new URL(href);
  expect(url.origin).toBe("https://portal.example.com");
  expect(REAL_ROUTES.has(url.pathname), `${url.pathname} is advertised but not served`).toBe(true);
}

describe("api-catalog linkset", () => {
  it("is a valid linkset with service-desc, service-doc and status links", () => {
    const catalog = buildApiCatalog();
    expect(Array.isArray(catalog.linkset)).toBe(true);
    const [entry] = catalog.linkset;
    expect(entry.anchor).toBe("https://portal.example.com/api");
    expect(entry["service-desc"][0]?.href).toBe("https://portal.example.com/openapi.json");
    for (const relation of [entry["service-desc"], entry["service-doc"], entry.status]) {
      for (const link of relation) {
        assertRealRoute(link.href);
      }
    }
  });
});

describe("llms.txt", () => {
  it("leads agents to the API surface and only links real routes", () => {
    const text = buildLlmsTxt();
    expect(text.startsWith("# Atlas")).toBe(true);
    expect(text).toContain("> Atlas is a governed context layer");
    const hrefs = [...text.matchAll(/\((https:\/\/[^)]+)\)/g)].map((match) => match[1]);
    expect(hrefs.length).toBeGreaterThanOrEqual(4);
    expect(hrefs[0]).toContain("/openapi.json");
    for (const href of hrefs) {
      assertRealRoute(href);
    }
  });
});

describe("homepage Link header", () => {
  it("advertises llms.txt, api-catalog, agent-skills, mcp and sitemap", () => {
    const header = buildHomeLinkHeader();
    for (const rel of ["llms-txt", "api-catalog", "agent-skills", "mcp-server", "sitemap"]) {
      expect(header).toContain(`rel="${rel}"`);
    }
    for (const match of header.matchAll(/<([^>]+)>/g)) {
      assertRealRoute(match[1]);
    }
  });
});

describe("origin is request-derived, not hardcoded", () => {
  const origin = "https://portal.acme.example";
  it("propagates the caller origin through every discovery surface", () => {
    expect(buildApiCatalog(origin).linkset[0].anchor).toBe(`${origin}/api`);
    expect(buildLlmsTxt(origin)).toContain(`${origin}/openapi.json`);
    expect(buildHomeLinkHeader(origin)).toContain(`<${origin}/llms.txt>`);
  });
});
