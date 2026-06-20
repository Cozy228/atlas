/**
 * Agent discovery artifacts served from the Portal origin: the api-catalog
 * linkset (RFC 9264), llms.txt, and the homepage `Link` header set. All of
 * them only point at routes this codebase actually serves — never advertise
 * what does not exist.
 */
import { PORTAL_ORIGIN } from "./openapiDocument.js";

export function buildApiCatalog() {
  return {
    linkset: [
      {
        anchor: `${PORTAL_ORIGIN}/api`,
        "service-desc": [
          { href: `${PORTAL_ORIGIN}/openapi.json`, type: "application/openapi+json" },
        ],
        "service-doc": [{ href: `${PORTAL_ORIGIN}/llms.txt`, type: "text/plain" }],
        status: [{ href: `${PORTAL_ORIGIN}/health`, type: "application/json" }],
      },
    ],
  };
}

/**
 * llms.txt is DevEx for engineers pointing AI-IDE agents at Atlas — not SEO.
 * It leads agents to the API surface first, pages second.
 */
export function buildLlmsTxt(): string {
  return `# Atlas

> Atlas is a governed context layer: it registers, validates, and serves authoritative source excerpts with citations. Every Excerpt is paired with a Citation; warnings like \`restricted_source\` and \`stale_source\` must be relayed verbatim.

## API (start here)

- [OpenAPI description](${PORTAL_ORIGIN}/openapi.json): the Context API contract — topic/source discovery, the context bundle, and feedback
- [API catalog](${PORTAL_ORIGIN}/.well-known/api-catalog): linkset pointing at the API description, docs, and health
- [MCP endpoint](${PORTAL_ORIGIN}/mcp): read-only MCP tools over the same Context API
- [Agent skills](${PORTAL_ORIGIN}/.well-known/agent-skills/index.json): the atlas-context-consumer skill teaches the bundle workflow

## Pages

- [Service catalog](${PORTAL_ORIGIN}/catalog): registered platform services
- [Sources](${PORTAL_ORIGIN}/sources): registered systems of record Atlas can cite
- [Guidance](${PORTAL_ORIGIN}/guidance): evidence-backed platform guidance
`;
}

type SitemapInput = {
  topicIds: ReadonlyArray<string>;
  sourceIds: ReadonlyArray<string>;
  guidanceIds: ReadonlyArray<string>;
};

/**
 * Canonical, crawlable pages only: catalog/source/guidance browsing. Mutation
 * flows and the Ask chat are deliberately excluded.
 */
export function buildSitemapXml({ topicIds, sourceIds, guidanceIds }: SitemapInput): string {
  const paths = [
    "/",
    "/catalog",
    "/sources",
    "/guidance",
    ...topicIds.map((id) => `/catalog/${encodeURIComponent(id)}`),
    ...sourceIds.map((id) => `/sources/${encodeURIComponent(id)}`),
    ...guidanceIds.map((id) => `/guidance/${encodeURIComponent(id)}`),
  ];
  const urls = paths
    .map((path) => `  <url><loc>${PORTAL_ORIGIN}${path}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** `Link` header values advertised on the homepage response. */
export function buildHomeLinkHeader(): string {
  const links: Array<[path: string, rel: string, type?: string]> = [
    ["/llms.txt", "llms-txt", "text/plain"],
    ["/openapi.json", "service-desc", "application/openapi+json"],
    ["/.well-known/api-catalog", "api-catalog", "application/linkset+json"],
    ["/.well-known/agent-skills/index.json", "agent-skills", "application/json"],
    ["/mcp", "mcp-server"],
    ["/sitemap.xml", "sitemap", "application/xml"],
  ];
  return links
    .map(([path, rel, type]) =>
      type
        ? `<${PORTAL_ORIGIN}${path}>; rel="${rel}"; type="${type}"`
        : `<${PORTAL_ORIGIN}${path}>; rel="${rel}"`,
    )
    .join(", ");
}
