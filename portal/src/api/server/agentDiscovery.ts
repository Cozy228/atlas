/**
 * Agent discovery artifacts served from the Portal origin: the api-catalog
 * linkset (RFC 9264), llms.txt, and the homepage `Link` header set. All of
 * them only point at routes this codebase actually serves — never advertise
 * what does not exist.
 */
import type { Topic } from "@atlas/schema";

import { serviceRouteParamsForTopic } from "@/lib/availability-service";
import { DEFAULT_PORTAL_ORIGIN } from "./portalOrigin";

/**
 * `/.well-known/ai-catalog.json` (proposal §8): capability discovery as a single
 * API entry — what Atlas can answer, with representative queries and tags — not
 * one entry per Section. The `getAtlasCapabilityCatalog` agent operation serves
 * it. Every `operationId` referenced here exists in the agent OpenAPI (§13.2).
 */
export function buildAiCatalog(origin: string = DEFAULT_PORTAL_ORIGIN) {
  return {
    name: "Atlas Context Layer",
    description:
      "Governed, live-resolved context for cloud platform resources, always with citations. Atlas resolves the resource and returns source-cited facts and evidence; the calling agent reads them to answer.",
    api: {
      type: "openapi",
      url: `${origin}/openapi.json`,
      documentation: `${origin}/llms.txt`,
      capabilities: [
        {
          id: "search-resources",
          operationId: "searchResources",
          // Read-face (ADR-0014): Discovery read — the agent-facing subset of the
          // Registry/Explore face. Resolves identity (name → id), not content.
          readFace: "Registry / Explore Read",
          description: "Resolve a product or service name to a canonical Atlas resource id.",
          representativeQueries: ["Resolve a service or product name to its Atlas resource id"],
        },
        {
          id: "resource-context",
          operationId: "getResourceContext",
          readFace: "Resource Context Read",
          description:
            "Live-resolve a known resource's sections (network, availability, security, …) with citations.",
          representativeQueries: [
            "Can this service run in a private subnet or via PrivateLink?",
            "Which regions and partitions support this service?",
            "How is data encrypted, and does it support customer-managed keys?",
            "Is there an approved Terraform module or starter example?",
          ],
        },
      ],
      tags: ["cloud", "platform", "governance", "availability", "networking", "security"],
    },
  };
}

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
 * It teaches the live-projection resource flow (searchResources →
 * getResourceContext), not the internal Topic model, and is the plain-text
 * counterpart of the agent OpenAPI. Every URL here must resolve (proposal §13.2).
 */
export function buildLlmsTxt(origin: string = DEFAULT_PORTAL_ORIGIN): string {
  return `# Atlas

> Atlas is a governed context layer for cloud platform resources. It live-resolves authoritative source excerpts with citations — it never stores or serves stale content, and it does not answer questions itself. You identify the resource and answer from the returned facts + evidence.

## Recommended procedure

1. If you already know the resource, call getResourceContext directly:
   \`GET /api/resources/{kind}/{slug}?sections=...\`
   e.g. \`GET /api/resources/service/aws/textract?sections=network,availability\`
2. If you only have a name, resolve it first:
   \`GET /api/resources?query=AWS%20Textract\` → returns the canonical \`{kind}/{slug}\`, a JSON \`resourceUrl\`, and a Markdown \`markdownUrl\`; then call \`resourceUrl\`.
3. Read \`sections[].content\` and \`sections[].citations\`; relay every warning verbatim.

## Section hints

- \`network\` — private subnet, VPC endpoint, PrivateLink, NAT, DNS, internet egress
- \`availability\` — supported regions, partitions, GovCloud, regional feature availability
- (the full per-kind \`sections\` vocabulary is in the OpenAPI \`sections\` enum)

## Reading results (honesty)

A missing or failed section is ABSENCE of data, never a negative answer:
- \`missingSections[].code\` / \`sections[].warnings[].code\` use Atlas warning codes: \`no_registered_source\`, \`source_unavailable\`, \`broken_anchor\`, \`stale_source\`, \`availability_unavailable\`, \`restricted_source\`.
- An "unsupported" conclusion is only valid when a resolved section's \`content\` cites source-backed evidence for it.

## Machine interfaces

- [Agent OpenAPI](${origin}/openapi.json): the four agent operations
- [Capability catalog](${origin}/.well-known/ai-catalog.json): what Atlas can answer
- [Resource JSON](${origin}/api/resources/service/aws/textract): a resource's Sections, live-resolved with citations
- [Resource Markdown](${origin}/resources/service/aws/textract.md): the same, as agent-readable Markdown

## Pages

- [Service catalog](${origin}/catalog): registered platform services, landing zones, and security policies
- [Sources](${origin}/sources): registered systems of record Atlas can cite
- [Guidance](${origin}/guidance): evidence-backed platform guidance flows
`;
}

type SitemapInput = {
  /** Topics with their type, so each links to its own surface: a service → its
   *  canonical resource address (plan 020 15d), a security policy → /policies. */
  topics: ReadonlyArray<Pick<Topic, "id" | "topic_type">>;
  sourceIds: ReadonlyArray<string>;
  guidanceIds: ReadonlyArray<string>;
  /** Canonical `{kind}/{slug}` ids for the agent-readable resource pages. */
  resourceIds?: ReadonlyArray<string>;
};

/** The crawlable detail path for a topic, by type. Services moved to their
 *  Resource address; landing zones (gone from the catalog, plan 019) have none. */
function topicDetailPath(topic: Pick<Topic, "id" | "topic_type">): string | null {
  if (topic.topic_type === "service") {
    const { provider, id } = serviceRouteParamsForTopic(topic);
    return `/service/${encodeURIComponent(provider)}/${encodeURIComponent(id)}`;
  }
  if (topic.topic_type === "security-policy") {
    return `/policies/${encodeURIComponent(topic.id)}`;
  }
  return null;
}

/**
 * Canonical, crawlable pages only: catalog/source/guidance browsing plus the
 * agent-readable resource Markdown pages (proposal §12). Mutation flows, the Ask
 * chat, and `/api/*` JSON endpoints are deliberately excluded.
 */
export function buildSitemapXml(
  { topics, sourceIds, guidanceIds, resourceIds = [] }: SitemapInput,
  origin: string = DEFAULT_PORTAL_ORIGIN,
): string {
  const paths = [
    "/",
    "/catalog",
    "/sources",
    "/guidance",
    ...topics.map(topicDetailPath).filter((path): path is string => path !== null),
    ...sourceIds.map((id) => `/sources/${encodeURIComponent(id)}`),
    ...guidanceIds.map((id) => `/guidance/${encodeURIComponent(id)}`),
    // {kind}/{slug} ids are pre-encoded path segments; encode each segment, not
    // the slashes, so /resources/service/aws/textract.md stays a real path.
    ...resourceIds.map((id) => `/resources/${id.split("/").map(encodeURIComponent).join("/")}.md`),
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
Disallow: /support
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
    ["/.well-known/ai-catalog.json", "ai-catalog", "application/json"],
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
