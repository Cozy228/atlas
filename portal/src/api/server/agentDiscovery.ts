/**
 * Agent discovery artifacts served from the Portal origin: the api-catalog
 * linkset (RFC 9264), llms.txt, and the homepage `Link` header set. All of
 * them only point at routes this codebase actually serves — never advertise
 * what does not exist.
 */
import { DEFAULT_PORTAL_ORIGIN } from "./portalOrigin";

export function buildApiCatalog(origin: string = DEFAULT_PORTAL_ORIGIN) {
  return {
    linkset: [
      {
        anchor: `${origin}/api`,
        "service-desc": [{ href: `${origin}/openapi.json`, type: "application/openapi+json" }],
        "service-doc": [{ href: `${origin}/llms.txt`, type: "text/plain" }],
        // Same governed contract, other renderings: MCP tools (incl.
        // `atlas_get_availability`) and the self-installing skill.
        "service-meta": [
          { href: `${origin}/mcp`, rel: "mcp-server" },
          {
            href: `${origin}/.well-known/agent-skills/index.json`,
            rel: "agent-skills",
            type: "application/json",
          },
        ],
        status: [{ href: `${origin}/health`, type: "application/json" }],
      },
    ],
  };
}

/**
 * llms.txt is DevEx for engineers pointing AI-IDE agents at Atlas — not SEO.
 * It leads agents to the API surface first, pages second.
 */
export function buildLlmsTxt(origin: string = DEFAULT_PORTAL_ORIGIN): string {
  return `# Atlas

> Atlas is a governed context layer: it registers, validates, and serves authoritative source excerpts with citations. Every Excerpt is paired with a Citation; warnings like \`restricted_source\` and \`stale_source\` must be relayed verbatim.

## API (start here)

- [OpenAPI description](${origin}/openapi.json): the Context API contract — base path \`/api\`; topic/source discovery (\`GET /api/topics\`, \`GET /api/sources\`), the cited context bundle (\`GET /api/topics/{id}/context\`), per-source content (\`GET /api/sources/{id}/content\`), and feedback
- [API catalog](${origin}/.well-known/api-catalog): linkset pointing at the API description, docs, and health
- [MCP endpoint](${origin}/mcp): read-only MCP tools over the same Context API — service search, the context bundle, source lookup, and service/region availability (\`atlas_get_availability\`)
- [Agent skills](${origin}/.well-known/agent-skills/index.json): the atlas-context-consumer skill teaches the bundle workflow

## What you can ask

- **Service capabilities & config** — e.g. private-networking/subnet usage: resolve a topic, then read its cited context bundle.
- **Regional / service availability** — which services are available, planned, or interim per region: the \`atlas_get_availability\` MCP tool, or the \`Regional Availability Matrix\` source via \`GET /api/sources/{id}/content\`.
- **Guardrails, policies & landing zones** — registered as topics (e.g. S3 guardrails, IAM boundary, private networking) and policy/guide sources.

Typical flow: \`GET /api/topics?query=<terms>\` → \`GET /api/topics/{id}/context\` → answer only from the returned Excerpts, each with its Citation, relaying every \`warnings[]\` entry verbatim. The OpenAPI \`description\` and the agent-skill carry the full conduct rules.

## Pages

- [Service catalog](${origin}/catalog): registered platform services, landing zones, and guardrail areas
- [Sources](${origin}/sources): registered systems of record Atlas can cite — Confluence guides, policy documents, Terraform modules, and the regional availability matrix
- [Guidance](${origin}/guidance): evidence-backed platform guidance flows
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
export function buildSitemapXml(
  { topicIds, sourceIds, guidanceIds }: SitemapInput,
  origin: string = DEFAULT_PORTAL_ORIGIN,
): string {
  const paths = [
    "/",
    "/catalog",
    "/sources",
    "/guidance",
    ...topicIds.map((id) => `/catalog/${encodeURIComponent(id)}`),
    ...sourceIds.map((id) => `/sources/${encodeURIComponent(id)}`),
    ...guidanceIds.map((id) => `/guidance/${encodeURIComponent(id)}`),
  ];
  const urls = paths.map((path) => `  <url><loc>${origin}${path}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Crawler policy, not an access boundary — private workflows stay
 * authenticated regardless. The `Sitemap:` line is the only absolute URL.
 */
export function buildRobotsTxt(origin: string = DEFAULT_PORTAL_ORIGIN): string {
  return `# Atlas Portal — robots.txt is a crawler policy, not an access boundary;
# private workflows stay authenticated regardless.

User-agent: *
Allow: /catalog/
Allow: /sources/
Allow: /guidance/
Allow: /llms.txt
Allow: /.well-known/
Disallow: /ask
Disallow: /api/

Content-Signal: ai-train=no, search=no, ai-input=yes

Sitemap: ${origin}/sitemap.xml
`;
}

/**
 * RFC 9728 protected-resource metadata. Generic by design: the Bearer pipe
 * (ADR 0001) defines no OAuth scopes, so none are advertised.
 */
export function buildOauthProtectedResource(origin: string = DEFAULT_PORTAL_ORIGIN) {
  return {
    resource: origin,
    bearer_methods_supported: ["header"],
    resource_documentation: `${origin}/llms.txt`,
    resource_name: "Atlas Context Layer",
  };
}

/** `Link` header values advertised on the homepage response. */
export function buildHomeLinkHeader(origin: string = DEFAULT_PORTAL_ORIGIN): string {
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
        ? `<${origin}${path}>; rel="${rel}"; type="${type}"`
        : `<${origin}${path}>; rel="${rel}"`,
    )
    .join(", ");
}
