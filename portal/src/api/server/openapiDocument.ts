/**
 * OpenAPI 3.1 descriptions of the Atlas API, in two renderings (proposal §6.7):
 *
 * - `buildAgentOpenApiDocument` → the root `/openapi.json`: a slim, executable
 *   contract exposing only the four agent operations (getAtlasInstructions,
 *   getAtlasCapabilityCatalog, searchResources, getResourceContext).
 * - `buildInternalOpenApiDocument` → `/api/internal/openapi.json`: the complete
 *   internal contract (topics, sources, context, feedback, resources) — every
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
  ContextBundleResponseSchema,
  ContextRequestSchema,
  ContextSectionSchema,
  FeedbackResponseSchema,
  FeedbackSubmissionSchema,
  MissingSectionSchema,
  ResourceCitationSchema,
  ResourceContextResponseSchema,
  ResourceSearchResponseSchema,
  ResourceSummarySchema,
  ResourceWarningSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  TopicDiscoveryResponseSchema,
  TopicResponseSchema,
  resourceKinds,
  sectionIds,
  sourceClasses,
  topicTypes,
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
- **Excerpt**: the text Atlas returns for an Anchor at request time, always paired with a Citation. Excerpts are ephemeral — resolved live, never durably ingested.
- **Citation**: the provenance attached to an Excerpt: \`source_id\`, \`anchor_id\`, label, and location. An Excerpt without a Citation is never returned.
- **Resolution**: the act of turning a registered Anchor into an Excerpt at request time.`;

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

/** Query parameters accepted by every bundle-shaped GET route. */
const contextQueryParams = [
  queryParam("anchor_id", "Scope the bundle to one registered Anchor."),
  queryParam("query", "Free-text intent used to select and rank Sources."),
  queryParam(
    "disclosure_level",
    "How much Excerpt text to disclose, 0 (citations only) to 3 (full sections).",
    { type: "integer", minimum: 0, maximum: 3 },
  ),
];

const BUNDLE_EXAMPLE = {
  bundle_id: "bundle-example-001",
  request: { topic_id: "aws-textract" },
  sources: [
    {
      source: {
        id: "textract-module-readme",
        title: "Textract Terraform Module",
        source_class: "terraform-module",
        location: "example/textract/aws",
        steward: "cloud-platform",
        visibility: "internal",
        authority_scope: ["module-usage", "private-networking"],
        authority_level: "authoritative",
        last_observed_at: "2026-05-05T00:00:00.000Z",
        last_reviewed_at: "2026-05-01T00:00:00.000Z",
        review_frequency: "P90D",
      },
      anchors: [
        {
          id: "private-subnet-usage",
          source_id: "textract-module-readme",
          anchor_strategy: "markdown-heading",
          title: "Private subnet usage",
          selector: { locator: "#private-subnet-usage" },
          citation_label: "Private subnet usage",
          status: "valid",
          last_validated_at: "2026-05-05T00:00:00.000Z",
        },
      ],
      selection_rationale: "Authoritative module README mapped to the requested topic.",
      excerpts: [
        {
          anchor_id: "private-subnet-usage",
          text: "Deploy the module into private subnets; the service endpoint is reached through a VPC endpoint.",
          citation: {
            source_id: "textract-module-readme",
            anchor_id: "private-subnet-usage",
            label: "Private subnet usage",
            location: "example/textract/aws",
          },
        },
      ],
    },
  ],
  anchor_references: [
    {
      source_id: "textract-module-readme",
      anchor_id: "private-subnet-usage",
      citation_label: "Private subnet usage",
      status: "valid",
    },
  ],
  warnings: [],
  expansion_paths: [
    {
      source_id: "textract-module-readme",
      anchor_id: "private-subnet-usage",
      disclosure_level: 2,
      label: "Expand: Private subnet usage",
    },
  ],
};

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
      "Live-resolve one resource/topic/Source's content from its registered Sources — every fact source-cited, never materialized.",
  },
  {
    name: READ_FACE.registry,
    description:
      "Query or browse Atlas's own registry: resolve a name to a canonical id, discover topics/Sources, list capabilities. Identity and index, not content. `searchResources` is the agent-facing Discovery-read subset.",
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

function internalPaths() {
  return {
    "/topics": {
      get: {
        tags: [READ_FACE.registry],
        operationId: "discoverTopics",
        summary: "Discover topics (services, landing zones, security policies)",
        description:
          "Search the registered topics. Internal discovery; agents use searchResources instead.",
        parameters: [
          queryParam("query", "Free-text search over topic names and descriptions."),
          queryParam("topic_type", "Filter by topic type.", {
            type: "string",
            enum: [...topicTypes],
          }),
          queryParam("category", "Filter by topic category."),
        ],
        responses: {
          "200": {
            description: "Matching topics.",
            content: jsonContent("TopicDiscoveryResponse"),
          },
          "400": errorResponse("`invalid_request` — malformed discovery filters."),
        },
      },
    },
    "/topics/{topic_id}": {
      get: {
        tags: [READ_FACE.registry],
        operationId: "getTopic",
        summary: "Get one topic's registry record",
        parameters: [topicIdParam()],
        responses: {
          "200": { description: "The topic.", content: jsonContent("TopicResponse") },
          "404": errorResponse("`topic_not_found` — no such topic is registered."),
        },
      },
    },
    "/topics/{topic_id}/context": {
      get: {
        tags: [READ_FACE.context],
        operationId: "getTopicContextBundle",
        summary: "Get the governed context bundle for a topic",
        description:
          "Internal context read. Returns Excerpts (each paired with its Citation), anchor references, warnings, and expansion paths for the topic's mapped Sources.",
        parameters: [topicIdParam(), ...contextQueryParams],
        responses: {
          "200": {
            description: "The context bundle. Relay every `warnings[]` entry verbatim.",
            content: jsonContent("ContextBundleResponse", BUNDLE_EXAMPLE),
          },
          "400": errorResponse("`invalid_request` — malformed context request."),
          "404": errorResponse("`topic_not_found` — no such topic is registered."),
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
          queryParam("topic_id", "Only Sources mapped to this topic."),
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
    "/sources/{source_id}/content": {
      get: {
        tags: [READ_FACE.context],
        operationId: "getSourceContextBundle",
        summary: "Get the context bundle scoped to one Source",
        description:
          "Explicit Source read: runtime warnings are promoted to HTTP errors instead of soft warnings.",
        parameters: [sourceIdParam(), ...contextQueryParams],
        responses: {
          "200": {
            description: "The context bundle for this Source.",
            content: jsonContent("ContextBundleResponse"),
          },
          "400": errorResponse("`invalid_request` — malformed context request."),
          "403": errorResponse(
            "`access_denied` — the Source is registered but the caller's identity is not allowed to see its content (the error form of `restricted_source`).",
          ),
          "404": errorResponse("`source_not_found` — no such Source is registered."),
          "422": errorResponse("`anchor_broken` — the requested Anchor could not be resolved."),
          "503": errorResponse("`source_unavailable` — the system of record could not be reached."),
        },
      },
    },
    "/context": {
      get: {
        tags: [READ_FACE.context],
        operationId: "getContextBundle",
        summary: "Get a context bundle from a free-text query",
        parameters: [...contextQueryParams],
        responses: {
          "200": {
            description:
              "The context bundle. An unanswerable request returns an empty bundle with a `no_registered_source` warning, not an error.",
            content: jsonContent("ContextBundleResponse"),
          },
          "400": errorResponse("`invalid_request` — malformed context request."),
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
    "/context-bundle": {
      post: {
        tags: [READ_FACE.context],
        operationId: "postContextBundle",
        summary: "Get a context bundle (request body form)",
        description:
          "Read-only despite the verb: POST is the body-carrying form of the same bundle read.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("ContextRequest"),
              example: { topic_id: "aws-textract", disclosure_level: 1 },
            },
          },
        },
        responses: {
          "200": {
            description: "The context bundle.",
            content: jsonContent("ContextBundleResponse", BUNDLE_EXAMPLE),
          },
          "400": errorResponse("`invalid_request` — malformed context request."),
          "403": errorResponse(
            "`access_denied` — explicit `source_id` request for a restricted Source.",
          ),
          "404": errorResponse("`topic_not_found` / `source_not_found` — unknown explicit id."),
          "422": errorResponse("`anchor_broken` — the requested Anchor could not be resolved."),
          "503": errorResponse("`source_unavailable` — the system of record could not be reached."),
        },
      },
    },
    "/feedback": {
      post: {
        tags: [READ_FACE.management],
        operationId: "submitFeedback",
        summary: "Submit feedback about a topic, Source, or Anchor",
        description:
          "The single mutation endpoint. Records that registered context is missing, stale, broken, or unclear.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: ref("FeedbackSubmission"),
              example: {
                target_type: "source",
                target_id: "textract-module-readme",
                feedback_type: "stale",
                message: "The private subnet section no longer matches the module inputs.",
              },
            },
          },
        },
        responses: {
          "201": { description: "Feedback recorded.", content: jsonContent("FeedbackResponse") },
          "400": errorResponse("`invalid_request` — malformed feedback submission."),
          "404": errorResponse("`topic_not_found` / `source_not_found` — unknown feedback target."),
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
      description: `${VOCABULARY}\n\n${WARNING_GLOSSARY}\n\n${BEARER_PIPE}\n\nThe complete internal contract: topic/source discovery, context bundles, the kind-first resource API, and feedback. Not advertised to blind agents — the slim agent contract is at \`/openapi.json\`. Every route is read-only except \`POST /feedback\`, the single mutation endpoint.`,
    },
    servers: [{ url: `${origin}/api`, description: "Atlas Portal origin" }],
    security: [{ bearerPipe: [] }, {}],
    tags: READ_FACE_TAGS,
    paths: internalPaths(),
    components: {
      securitySchemes: bearerSecurityScheme,
      schemas: {
        TopicDiscoveryResponse: toJsonSchema(TopicDiscoveryResponseSchema),
        TopicResponse: toJsonSchema(TopicResponseSchema),
        SourceDiscoveryResponse: toJsonSchema(SourceDiscoveryResponseSchema),
        SourceResponse: toJsonSchema(SourceResponseSchema),
        ContextRequest: toJsonSchema(ContextRequestSchema),
        ContextBundleResponse: {
          ...toJsonSchema(ContextBundleResponseSchema),
          description: `The governed bundle. Every Excerpt carries its Citation — never present one without the other.\n\n${WARNING_GLOSSARY}`,
        },
        AvailabilityReadResponse: toJsonSchema(AvailabilityReadResponseSchema),
        FeedbackSubmission: toJsonSchema(FeedbackSubmissionSchema),
        FeedbackResponse: toJsonSchema(FeedbackResponseSchema),
        ApiErrorResponse: toJsonSchema(ApiErrorResponseSchema),
        ...resourceSchemas(),
      },
    },
  };
}

function topicIdParam() {
  return {
    name: "topic_id",
    in: "path",
    required: true,
    description: "Registered topic id (semantic, e.g. `aws-textract`).",
    schema: { type: "string" },
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
