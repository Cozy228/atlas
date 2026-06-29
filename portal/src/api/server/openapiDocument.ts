/**
 * OpenAPI 3.1 descriptions of the Atlas API, in two renderings (proposal §6.7):
 *
 * - `buildAgentOpenApiDocument` → the root `/openapi.json`: a slim, executable
 *   contract exposing only the four agent operations (getAtlasInstructions,
 *   getAtlasCapabilityCatalog, searchResources, getResourceContext).
 * - `buildInternalOpenApiDocument` → `/api/internal/openapi.json`: the complete
 *   internal contract (resource catalog, sources, context, feedback, resources) — every
 *   route the Context Layer router dispatches, not advertised to blind agents.
 *
 * Component schemas are derived from `@atlas/schema` (zod) via `z.toJSONSchema()`,
 * never hand-maintained. `openapiDocument.test.ts` asserts `agent ⊆ router ==
 * internal`: every agent `/api/*` path dispatches, and the internal doc mirrors
 * the router exactly in both directions.
 */
import { z } from "zod";
import {
  ApiErrorResponseSchema,
  AvailabilityReadResponseSchema,
  ContextSectionSchema,
  FeedbackResponseSchema,
  FeedbackSubmissionSchema,
  MissingSectionSchema,
  ResourceCatalogResponseSchema,
  ResourceCitationSchema,
  ResourceContextResponseSchema,
  ResourceRecordResponseSchema,
  ResourceSearchResponseSchema,
  ResourceSummarySchema,
  ResourceWarningSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  resourceKinds,
  sectionIds,
  sourceClasses,
} from "@atlas/schema";
import { listResourceKinds, resourceKindRegistry } from "@atlas/context-layer";
import { DEFAULT_PORTAL_ORIGIN } from "./portalOrigin";

/**
 * Atlas vocabulary, inlined so agents get the glossary without a second
 * fetch. Definitions are the `CONTEXT.md` ones, verbatim where they matter.
 */
const VOCABULARY = `Atlas is a governed context layer: it registers, validates, and serves authoritative source excerpts with citations. Source systems remain the system of record; Atlas never mirrors them durably.

Vocabulary:
- **Source**: a registered system-of-record document Atlas can cite, identified by \`source_class\`.
- **Anchor**: a registered, citable location within a Source (a heading, a section, a clause).
- **Section**: a projected slice of a Resource, its content live-resolved from one or more registered Sources at request time. Content is ephemeral — resolved live, never durably ingested.
- **Citation**: the provenance attached to a Section's content: \`sourceId\`, \`anchor\`, title, and url. Resolved content is never returned without its Citations.
- **Resolution**: the act of live-resolving a Resource's registered Sources into Section content at request time.`;

const AGENT_INTRO = `Machine-readable access to approved Atlas resources, their context, and supporting evidence.

Atlas is a read-only data service. It does not interpret or answer arbitrary natural-language questions: the calling agent identifies the relevant resource, retrieves its available context, and answers from the returned facts and evidence.

Recommended flow: if you do not know the canonical resource id, call \`searchResources\` to resolve a name (e.g. "AWS Textract") to \`{kind}/{slug}\`; then call \`getResourceContext\` to live-resolve its Sections. A missing or failed Section is absence of data, never a negative answer.`;

const WARNING_GLOSSARY = `Warning codes (in \`warnings[]\` / \`missingSections[].code\`; consumers must relay them verbatim):
- \`restricted_source\`: this Source exists but the caller's identity is not allowed to see its content (registry-declared restriction or runtime ACL denial — both converge on this one code).
- \`stale_source\`: the registered record may no longer match the live source of record (past its review frequency, or the live version is newer than the version Atlas recorded; distinguished only by the message).
- \`broken_anchor\`: a registered Anchor could not be resolved in the live Source.
- \`authority_conflict\`: overlapping Sources disagree about who is authoritative.
- \`source_unavailable\`: the system of record could not be reached at resolve time.
- \`weak_anchoring\`: the Anchor matched, but with low confidence.
- \`no_registered_source\`: nothing registered answers the request (e.g. a Section with no registered Source).
- \`availability_unavailable\`: the availability matrix could not be fetched or parsed; no availability data is returned and never a stale matrix.`;

const BEARER_PIPE = `Identity-agnostic Bearer pipe (ADR 0001): Atlas reads an opaque Bearer from the \`Authorization\` header and threads it, unparsed, to the system of record, whose own ACL decides what comes back. Atlas never decides whose identity it is. Without a token, a deliberately narrow-scoped service-token fallback applies, so the fallback cannot leak content a caller could not see.`;

type JsonSchema = Record<string, unknown>;

/** Convert a zod schema to a self-contained JSON Schema (no root `$schema`). */
function toJsonSchema(schema: z.ZodType): JsonSchema {
  const { $schema: _discarded, ...jsonSchema } = z.toJSONSchema(schema) as JsonSchema & {
    $schema?: string;
  };
  return jsonSchema;
}

function ref(name: string) {
  return { $ref: `#/components/schemas/${name}` };
}

function jsonContent(schemaName: string, example?: unknown) {
  return {
    "application/json": {
      schema: ref(schemaName),
      ...(example !== undefined ? { example } : {}),
    },
  };
}

function errorResponse(description: string) {
  return { description, content: jsonContent("ApiErrorResponse") };
}

function queryParam(name: string, description: string, schema: JsonSchema = { type: "string" }) {
  return { name, in: "query", required: false, description, schema };
}

const RESOURCE_CONTEXT_EXAMPLE = {
  resource: {
    kind: "service",
    id: "service/aws/textract",
    slug: "aws/textract",
    provider: "aws",
    name: "Amazon Textract",
    aliases: ["AWS Textract", "Textract"],
    resourceUrl: "https://portal.example.com/api/resources/service/aws/textract",
    markdownUrl: "https://portal.example.com/resources/service/aws/textract.md",
  },
  requestedSections: ["network", "availability"],
  sections: {
    network: {
      status: "available",
      content:
        "Use the Textract module with private endpoint configuration for private subnet workloads.",
      citations: [
        {
          sourceId: "textract-module-readme",
          title: "Textract Terraform Module",
          url: "example/textract/aws#private-subnet-usage",
          anchor: "private-subnet-usage",
          resolvedAt: "2026-05-05T00:00:00.000Z",
        },
      ],
      warnings: [],
    },
    availability: {
      status: "available",
      content: "Textract — us-east-1: available; ca-central-1: available.",
      citations: [
        {
          sourceId: "availability-matrix",
          title: "Regional Availability Matrix",
          url: "https://confluence.example.com/display/CLOUD/Regional+Availability+Matrix",
          anchor: "availability-textract-row",
          resolvedAt: "2026-05-05T00:00:00.000Z",
        },
      ],
      warnings: [],
    },
  },
  missingSections: [],
  // Reference-only discovered document links (plan 017 B5), surfaced ALONGSIDE
  // the governed Sections above and clearly distinguished: the agent learns a
  // page EXISTS, never that its body was obtained (content_mode: reference_only,
  // agent_accessible: false). Confluence bodies are unreadable without user creds.
  references: [
    {
      title: "Textract — service design",
      url: "https://confluence.example.com/display/CLOUD/Textract+Service+Design",
      doc_type: "design",
      last_observed_at: "2026-06-26T10:30:00.000Z",
      content_mode: "reference_only",
      access_mode: "service_credentials",
      agent_accessible: false,
    },
  ],
  // Discovery cache/freshness state for the references above (plan 017 B12).
  referenceDiscovery: {
    status: "fresh",
    last_observed_at: "2026-06-26T10:30:00.000Z",
    incomplete: false,
  },
  resolvedAt: "2026-06-26T10:30:00.000Z",
};

/** Per-kind Section applicability, generated from the resource-kind registry. */
function kindSectionNote(): string {
  return listResourceKinds()
    .map((kind) => `${kind}: ${resourceKindRegistry[kind].sections.map((s) => s.id).join(", ")}`)
    .join("; ");
}

/* -------------------------------------------------------------------------- *
 * Read-face tags (ADR-0014): the surface is split by what is read, not by who
 * reads it. Three faces map to two OpenAPI documents; `searchResources` is the
 * agent-facing "Discovery read" subset of Registry/Explore.
 * -------------------------------------------------------------------------- */

const READ_FACE = {
  context: "Resource Context Read",
  registry: "Registry / Explore Read",
  management: "Management",
} as const;

const READ_FACE_TAGS = [
  {
    name: READ_FACE.context,
    description:
      "Live-resolve one resource/Source's content from its registered Sources — every fact source-cited, never materialized.",
  },
  {
    name: READ_FACE.registry,
    description:
      "Query or browse Atlas's own registry: resolve a name to a canonical id, discover resources/Sources, list capabilities. Identity and index, not content. `searchResources` is the agent-facing Discovery-read subset.",
  },
  {
    name: READ_FACE.management,
    description: "Mutate or configure Atlas — the single `POST /feedback` mutation today.",
  },
];

/* -------------------------------------------------------------------------- *
 * Operation objects, shared between the agent and internal documents.
 * -------------------------------------------------------------------------- */

function searchResourcesOperation() {
  return {
    get: {
      tags: [READ_FACE.registry],
      operationId: "searchResources",
      summary: "Find the canonical Atlas resource for a product or service",
      description:
        'Use this operation only when the canonical `{kind}/{slug}` is unknown. Searching for a name (e.g. "AWS Textract") returns the canonical resource id (`service/aws/textract`), a JSON resource URL, and a Markdown resource URL. It answers no product questions — after selecting the correct result, call getResourceContext. An unmatched query returns an empty `items[]` (not an error). This is a Discovery read — the agent-facing subset of the Registry/Explore face: it resolves identity (name → id), not content.',
      parameters: [
        {
          name: "query",
          in: "query",
          required: true,
          description: "Product, service, platform, or resource name.",
          schema: { type: "string" },
          examples: { textract: { value: "AWS Textract" } },
        },
      ],
      responses: {
        "200": {
          description: "Matching canonical Atlas resources.",
          content: jsonContent("ResourceSearchResponse"),
        },
        "400": errorResponse("`invalid_request` — the `query` parameter is missing or empty."),
      },
    },
  };
}

function getResourceContextOperation() {
  return {
    get: {
      tags: [READ_FACE.context],
      operationId: "getResourceContext",
      summary: "Live-resolve the registered Sources for a known resource's Sections",
      description: [
        "The primary operation for answering questions about a known product or service.",
        "",
        "It attempts LIVE resolution of the Sources and Anchors registered for the requested Sections. Atlas does not persist resolved excerpts and does not return stale cached content when a Source cannot be resolved. By default it resolves all Sections registered for the kind; use `sections` to narrow.",
        "",
        "The response may contain partial results and per-Section warnings. A missing or failed Section MUST NOT be read as a negative answer (see `missingSections[].code` and `sections[].warnings[].code`). A negative conclusion is only valid when source-backed evidence inside a resolved Section's `content` states it.",
        "",
        "Example: resolve a service name, then read its network + availability Sections together.",
        "Recommended call: GET /api/resources/service/aws/textract?sections=network,availability",
        "",
        "If the canonical `{kind}/{slug}` is unknown, call searchResources first.",
      ].join("\n"),
      parameters: [
        {
          name: "kind",
          in: "path",
          required: true,
          description:
            "Resource kind from the Atlas resource-kind registry (extensible and authoritative — not a frozen list).",
          schema: { type: "string", enum: [...resourceKinds] },
        },
        {
          name: "slug",
          in: "path",
          required: true,
          description:
            "Canonical slug within the kind, returned by searchResources. For kind=service the slug is provider-qualified (e.g. `aws/textract`).",
          schema: { type: "string" },
        },
        {
          name: "sections",
          in: "query",
          required: false,
          description: `Comma-separated Sections to return; omit for every Section registered for the kind. Use \`network\` for private subnet / VPC endpoint / PrivateLink / egress / DNS questions, and \`availability\` for supported regions / partitions / regional feature questions. The enum below is the union across kinds; per-kind applicability — ${kindSectionNote()}.`,
          style: "form",
          explode: false,
          schema: {
            type: "array",
            uniqueItems: true,
            items: { type: "string", enum: [...sectionIds] },
          },
        },
      ],
      responses: {
        "200": {
          description: "Atlas context grouped by stable Sections.",
          content: jsonContent("ResourceContextResponse", RESOURCE_CONTEXT_EXAMPLE),
        },
        "400": errorResponse("`invalid_request` — unknown `kind` or unknown `sections` value."),
        "404": errorResponse(
          "`resource_not_found` — no such resource is registered; call searchResources to resolve the canonical id.",
        ),
        "503": errorResponse("`source_unavailable` — a registered Source could not be reached."),
      },
    },
  };
}

/* -------------------------------------------------------------------------- *
 * Internal (full) operations.
 * -------------------------------------------------------------------------- */

/** Resource presentation-metadata read (plan 020 15d). Portal-internal — the
 *  resource-first page composes this metadata + the content projection; kept off
 *  the slim agent contract (getResourceContext stays content-only, ADR-0015 §1). */
function getResourceRecordOperation() {
  return {
    get: {
      tags: [READ_FACE.context],
      operationId: "getResourceRecord",
      summary: "Read a resource's presentation metadata (owner, support, entry tools)",
      description:
        "The identity / presentation metadata migrated onto the Resource record (ADR-0015 §2): owner, support channel, category, status, and entry tools, all derived from discovery. Optional fields are honest-gap — a spine-only service returns identity only (kind, id, slug, name, aliases).",
      parameters: [
        {
          name: "kind",
          in: "path",
          required: true,
          description: "Resource kind from the Atlas resource-kind registry.",
          schema: { type: "string", enum: [...resourceKinds] },
        },
        {
          name: "slug",
          in: "path",
          required: true,
          description: "Canonical slug within the kind (e.g. `aws/textract` for kind=service).",
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "The resource's presentation metadata.",
          content: jsonContent("ResourceRecordResponse"),
        },
        "400": errorResponse("`invalid_request` — unknown `kind`."),
        "404": errorResponse("`resource_not_found` — no such resource is registered."),
      },
    },
  };
}

function internalPaths() {
  return {
    "/resources/catalog": {
      get: {
        tags: [READ_FACE.registry],
        operationId: "discoverResources",
        summary: "List the discovery-derived resource catalog (services + security policies)",
        description:
          "The full discovered resource inventory as presentation records — the Portal catalog facets on `category`, tabs on `kind` (service / guardrail), and links by `slug`. Returns every resource in one read; internal discovery, agents resolve a single resource via searchResources instead.",
        responses: {
          "200": {
            description: "The resource catalog.",
            content: jsonContent("ResourceCatalogResponse"),
          },
        },
      },
    },
    "/sources": {
      get: {
        tags: [READ_FACE.registry],
        operationId: "discoverSources",
        summary: "Discover registered Sources",
        parameters: [
          queryParam("query", "Free-text search over Source titles and scopes."),
          queryParam("source_class", "Filter by source class.", {
            type: "string",
            enum: [...sourceClasses],
          }),
        ],
        responses: {
          "200": {
            description: "Matching Sources.",
            content: jsonContent("SourceDiscoveryResponse"),
          },
          "400": errorResponse("`invalid_request` — malformed discovery filters."),
        },
      },
    },
    "/sources/{source_id}": {
      get: {
        tags: [READ_FACE.registry],
        operationId: "getSource",
        summary: "Get one Source's registry record",
        parameters: [sourceIdParam()],
        responses: {
          "200": { description: "The Source.", content: jsonContent("SourceResponse") },
          "404": errorResponse("`source_not_found` — no such Source is registered."),
        },
      },
    },
    "/availability": {
      get: {
        tags: [READ_FACE.registry],
        operationId: "getAvailability",
        summary: "Read the regional service availability grid",
        description:
          "The single availability read (plan 014): the AWS + Azure landing-zone grid of services × locations, paired with the governing Citation and any freshness warnings. One cited source of record behind the Portal Explore surface and the MCP availability tool.",
        responses: {
          "200": {
            description:
              "The availability grid with its Citation. Relay every `warnings[]` entry verbatim.",
            content: jsonContent("AvailabilityReadResponse"),
          },
          "404": errorResponse(
            "`source_not_found` — the availability matrix source is not registered.",
          ),
        },
      },
    },
    "/resources": searchResourcesOperation(),
    "/resources/{kind}/{slug}": getResourceContextOperation(),
    "/resources/{kind}/{slug}/record": getResourceRecordOperation(),
    "/feedback": {
      post: {
        tags: [READ_FACE.management],
        operationId: "submitFeedback",
        summary: "Submit feedback about a resource, Source, or Anchor",
        description:
          "The single mutation endpoint. Records that registered context is missing, stale, broken, or unclear.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("FeedbackSubmission"),
              example: {
                target_type: "resource",
                target_id: "service/aws/textract",
                feedback_type: "stale",
                message:
                  "The availability section no longer matches the regions this service supports.",
              },
            },
          },
        },
        responses: {
          "201": { description: "Feedback recorded.", content: jsonContent("FeedbackResponse") },
          "400": errorResponse("`invalid_request` — malformed feedback submission."),
          "404": errorResponse(
            "`resource_not_found` / `source_not_found` — unknown feedback target.",
          ),
          "422": errorResponse("`anchor_broken` — unknown anchor feedback target."),
        },
      },
    },
  };
}

function resourceSchemas() {
  return {
    ResourceSearchResponse: toJsonSchema(ResourceSearchResponseSchema),
    ResourceContextResponse: {
      ...toJsonSchema(ResourceContextResponseSchema),
      description: `The resource's Sections, live-resolved with citations and grouped by Section (ADR-0013). Two orthogonal axes: each Section's \`status\` (available/partial/unresolved) and its \`warnings[].code\`. A missing or failed Section is absence of data, never a negative answer.\n\n${WARNING_GLOSSARY}`,
    },
    ResourceSummary: toJsonSchema(ResourceSummarySchema),
    ContextSection: toJsonSchema(ContextSectionSchema),
    Citation: toJsonSchema(ResourceCitationSchema),
    Warning: toJsonSchema(ResourceWarningSchema),
    MissingSection: toJsonSchema(MissingSectionSchema),
  };
}

const bearerSecurityScheme = {
  bearerPipe: { type: "http", scheme: "bearer", description: BEARER_PIPE },
};

/**
 * The slim agent contract served at `/openapi.json`. Server is the bare origin
 * (paths mix `/llms.txt` with `/api/resources`).
 */
export function buildAgentOpenApiDocument(origin: string = DEFAULT_PORTAL_ORIGIN) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Atlas Agent API",
      version: "1.0.0",
      description: `${AGENT_INTRO}\n\n${WARNING_GLOSSARY}\n\n${BEARER_PIPE}`,
    },
    servers: [{ url: origin, description: "Atlas Portal origin" }],
    security: [{ bearerPipe: [] }, {}],
    // Agent doc spans two faces: Resource Context Read + the Discovery subset of
    // Registry/Explore. No Management face — the agent contract is read-only.
    tags: READ_FACE_TAGS.filter((tag) => tag.name !== READ_FACE.management),
    paths: {
      "/llms.txt": {
        get: {
          tags: [READ_FACE.registry],
          operationId: "getAtlasInstructions",
          summary: "Read concise instructions for discovering and using Atlas",
          description:
            "Redundant discovery entry point. Returns a short Markdown brief: what Atlas is, the machine-readable entry points, the recommended call flow (searchResources → getResourceContext), and how to read warnings. No OpenAPI tooling required.",
          responses: {
            "200": {
              description: "Atlas instructions and machine-readable entry points.",
              content: { "text/markdown": { schema: { type: "string" } } },
            },
          },
        },
      },
      "/.well-known/ai-catalog.json": {
        get: {
          tags: [READ_FACE.registry],
          operationId: "getAtlasCapabilityCatalog",
          summary: "Discover Atlas machine-readable capabilities",
          description:
            "Redundant discovery entry point. Returns the capability catalog: the Atlas API entry, its capabilities, representative queries, and tags. Confirm what Atlas can answer before calling the resource operations.",
          responses: {
            "200": {
              description: "Atlas capability catalog.",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/resources": searchResourcesOperation(),
      "/api/resources/{kind}/{slug}": getResourceContextOperation(),
    },
    components: {
      securitySchemes: bearerSecurityScheme,
      schemas: {
        ...resourceSchemas(),
        ApiErrorResponse: toJsonSchema(ApiErrorResponseSchema),
      },
    },
  };
}

/**
 * The complete internal contract served at `/api/internal/openapi.json`. Server
 * is `${origin}/api`; every path mirrors a Context Layer router dispatch.
 */
export function buildInternalOpenApiDocument(origin: string = DEFAULT_PORTAL_ORIGIN) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Atlas Internal API",
      version: "1.0.0",
      description: `${VOCABULARY}\n\n${WARNING_GLOSSARY}\n\n${BEARER_PIPE}\n\nThe complete internal contract: resource-catalog and Source discovery, the kind-first resource API, and feedback. Not advertised to blind agents — the slim agent contract is at \`/openapi.json\`. Every route is read-only except \`POST /feedback\`, the single mutation endpoint.`,
    },
    servers: [{ url: `${origin}/api`, description: "Atlas Portal origin" }],
    security: [{ bearerPipe: [] }, {}],
    tags: READ_FACE_TAGS,
    paths: internalPaths(),
    components: {
      securitySchemes: bearerSecurityScheme,
      schemas: {
        ResourceCatalogResponse: toJsonSchema(ResourceCatalogResponseSchema),
        SourceDiscoveryResponse: toJsonSchema(SourceDiscoveryResponseSchema),
        SourceResponse: toJsonSchema(SourceResponseSchema),
        AvailabilityReadResponse: toJsonSchema(AvailabilityReadResponseSchema),
        FeedbackSubmission: toJsonSchema(FeedbackSubmissionSchema),
        FeedbackResponse: toJsonSchema(FeedbackResponseSchema),
        ApiErrorResponse: toJsonSchema(ApiErrorResponseSchema),
        ...resourceSchemas(),
        ResourceRecordResponse: toJsonSchema(ResourceRecordResponseSchema),
      },
    },
  };
}

function sourceIdParam() {
  return {
    name: "source_id",
    in: "path",
    required: true,
    description: "Registered Source id (semantic, e.g. `textract-module-readme`).",
    schema: { type: "string" },
  };
}
