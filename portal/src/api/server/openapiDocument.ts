/**
 * OpenAPI 3.1 description of the Context API.
 *
 * One contract, two renderings: component schemas are derived from
 * `@atlas/schema` (zod) via `z.toJSONSchema()`, never hand-maintained, and
 * the path list mirrors exactly what `context-layer/src/api/httpRoute.ts`
 * dispatches — `openapiDocument.test.ts` asserts that parity in both
 * directions. Served at `/openapi.json` on the Portal origin.
 */
import { z } from "zod";
import {
  ApiErrorResponseSchema,
  ContextBundleResponseSchema,
  ContextRequestSchema,
  FeedbackResponseSchema,
  FeedbackSubmissionSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  TopicDiscoveryResponseSchema,
  TopicResponseSchema,
  sourceClasses,
  topicTypes,
} from "@atlas/schema";

export const PORTAL_ORIGIN = "https://portal.example.com";

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

const WARNING_GLOSSARY = `Warning codes (in \`warnings[]\`; consumers must relay them verbatim):
- \`restricted_source\`: this Source exists but the caller's identity is not allowed to see its content (registry-declared restriction or runtime ACL denial — both converge on this one code).
- \`stale_source\`: the registered record may no longer match the live source of record (past its review frequency, or the live version is newer than the version Atlas recorded; distinguished only by the message).
- \`broken_anchor\`: a registered Anchor could not be resolved in the live Source.
- \`authority_conflict\`: overlapping Sources disagree about who is authoritative.
- \`source_unavailable\`: the system of record could not be reached at resolve time.
- \`weak_anchoring\`: the Anchor matched, but with low confidence.
- \`no_registered_source\`: nothing registered answers the request.`;

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

function queryParam(
  name: string,
  description: string,
  schema: JsonSchema = { type: "string" },
) {
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
        location: "github.com/acme/terraform-aws-textract",
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
            location: "github.com/acme/terraform-aws-textract",
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

export function buildOpenApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Atlas Context API",
      version: "1.0.0",
      description: `${VOCABULARY}\n\n${WARNING_GLOSSARY}\n\n${BEARER_PIPE}\n\nEvery route is read-only except \`POST /feedback\`, the single mutation endpoint.`,
    },
    servers: [{ url: `${PORTAL_ORIGIN}/api`, description: "Atlas Portal origin" }],
    security: [{ bearerPipe: [] }, {}],
    paths: {
      "/topics": {
        get: {
          operationId: "discoverTopics",
          summary: "Discover topics (capabilities, landing zones, guardrail areas)",
          description:
            "Search the registered topics. Start here to resolve a free-text question to a `topic_id`.",
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
          operationId: "getTopicContextBundle",
          summary: "Get the governed context bundle for a topic",
          description:
            "The primary read. Returns Excerpts (each paired with its Citation), anchor references, warnings, and expansion paths for the topic's mapped Sources.",
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
      "/context-bundle": {
        post: {
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
            "403": errorResponse("`access_denied` — explicit `source_id` request for a restricted Source."),
            "404": errorResponse("`topic_not_found` / `source_not_found` — unknown explicit id."),
            "422": errorResponse("`anchor_broken` — the requested Anchor could not be resolved."),
            "503": errorResponse("`source_unavailable` — the system of record could not be reached."),
          },
        },
      },
      "/feedback": {
        post: {
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
            "201": {
              description: "Feedback recorded.",
              content: jsonContent("FeedbackResponse"),
            },
            "400": errorResponse("`invalid_request` — malformed feedback submission."),
            "404": errorResponse("`topic_not_found` / `source_not_found` — unknown feedback target."),
            "422": errorResponse("`anchor_broken` — unknown anchor feedback target."),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerPipe: {
          type: "http",
          scheme: "bearer",
          description: BEARER_PIPE,
        },
      },
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
        FeedbackSubmission: toJsonSchema(FeedbackSubmissionSchema),
        FeedbackResponse: toJsonSchema(FeedbackResponseSchema),
        ApiErrorResponse: toJsonSchema(ApiErrorResponseSchema),
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
