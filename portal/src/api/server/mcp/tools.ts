/**
 * The curated, read-only MCP tool set over the Context API.
 *
 * Four namespaced tools mirror Atlas's reads — search-first, not
 * one-per-endpoint. Responses keep Atlas's semantic ids and always carry the
 * Citation; warnings are passed through verbatim. No write tool exists, by
 * decision (reads first; any future mutation needs audit + human confirm).
 */
import { z } from "zod";
import { topicTypes, type ContextBundleResponse } from "@atlas/schema";

import type { ContextApiClient } from "../../contextApiClient";
import { ContextApiError } from "../../contextApiError";

const ResponseFormatSchema = z
  .enum(["CONCISE", "DETAILED"])
  .default("CONCISE")
  .describe("CONCISE returns high-signal fields only; DETAILED returns full records.");

const PageSchema = {
  limit: z.number().int().min(1).max(50).default(10).describe("Max items to return."),
  offset: z.number().int().min(0).default(0).describe("Items to skip (pagination)."),
};

/** Cap any single excerpt so a bundle stays well under the response budget. */
const CONCISE_EXCERPT_CHARS = 1500;

const NARROW_HINT = "Result was truncated; narrow your search (add query terms or filters).";

const SearchServiceInput = z.object({
  query: z.string().min(1).optional().describe("Free-text search, e.g. 'textract ocr'."),
  topic_type: z.enum(topicTypes).optional(),
  category: z.string().min(1).optional(),
  response_format: ResponseFormatSchema,
  ...PageSchema,
});

const GetSourceInput = z.object({
  source_id: z.string().min(1).describe("Registered Source id, e.g. 'textract-module-readme'."),
  response_format: ResponseFormatSchema,
});

const GetAvailabilityInput = z.object({
  zone: z.enum(["aws", "azure"]).optional().describe("Landing zone to inspect."),
  service_query: z.string().min(1).optional().describe("Filter services by name."),
  location_id: z.string().min(1).optional().describe("One region/outpost id, e.g. 'us-east-1'."),
  ...PageSchema,
});

const GetContextBundleInput = z.object({
  topic_id: z.string().min(1).optional().describe("Topic id from atlas_search_service."),
  source_id: z.string().min(1).optional(),
  anchor_id: z.string().min(1).optional(),
  query: z.string().min(1).optional().describe("Free-text intent when no id is known."),
  disclosure_level: z.number().int().min(0).max(3).optional(),
  response_format: ResponseFormatSchema,
});

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run(args: unknown, client: ContextApiClient): Promise<unknown>;
};

function toInputSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _discarded, ...jsonSchema } = z.toJSONSchema(schema, {
    io: "input",
  }) as Record<string, unknown> & { $schema?: string };
  return jsonSchema;
}

function conciseBundle(bundle: ContextBundleResponse) {
  let truncated = false;
  const excerpts = bundle.sources.flatMap((source) =>
    source.excerpts.map((excerpt) => {
      if (excerpt.text.length > CONCISE_EXCERPT_CHARS) {
        truncated = true;
      }
      return {
        source_id: source.source.id,
        text: excerpt.text.slice(0, CONCISE_EXCERPT_CHARS),
        citation: excerpt.citation,
      };
    }),
  );
  return {
    bundle_id: bundle.bundle_id,
    excerpts,
    warnings: bundle.warnings,
    expansion_paths: bundle.expansion_paths,
    ...(truncated ? { truncated, hint: NARROW_HINT } : {}),
  };
}

export const mcpTools: McpToolDefinition[] = [
  {
    name: "atlas_search_service",
    description:
      "Search Atlas's registered topics (services, landing zones, security policies) by free text. Start here to resolve a question to a topic_id, then call atlas_get_context_bundle.",
    inputSchema: toInputSchema(SearchServiceInput),
    async run(args, client) {
      const input = SearchServiceInput.parse(args ?? {});
      const { topics } = await client.discoverTopics({
        query: input.query,
        topic_type: input.topic_type,
        category: input.category,
      });
      const page = topics.slice(input.offset, input.offset + input.limit);
      return {
        total: topics.length,
        offset: input.offset,
        returned: page.length,
        ...(topics.length > input.offset + page.length ? { hint: NARROW_HINT } : {}),
        topics:
          input.response_format === "DETAILED"
            ? page
            : page.map((topic) => ({
                id: topic.id,
                name: topic.name,
                topic_type: topic.topic_type,
                description: topic.description,
              })),
      };
    },
  },
  {
    name: "atlas_get_source",
    description:
      "Get one registered Source's registry record (steward, authority, review cadence) by source_id. Use atlas_get_context_bundle with that source_id to read its cited content.",
    inputSchema: toInputSchema(GetSourceInput),
    async run(args, client) {
      const input = GetSourceInput.parse(args ?? {});
      const { source } = await client.getSource(input.source_id);
      if (input.response_format === "DETAILED") {
        return { source };
      }
      return {
        source: {
          id: source.id,
          title: source.title,
          source_class: source.source_class,
          location: source.location,
          authority_level: source.authority_level,
          visibility: source.visibility,
        },
      };
    },
  },
  {
    name: "atlas_get_availability",
    description:
      "Check which platform services are available, planned, or interim per region/outpost in the AWS and Azure landing zones.",
    inputSchema: toInputSchema(GetAvailabilityInput),
    async run(args, client) {
      const input = GetAvailabilityInput.parse(args ?? {});
      // One cited Context Layer read backs the whole grid (plan 014): the
      // Citation and any freshness warnings are relayed alongside the matches.
      const { zones: allZones, citation, warnings } = await client.getAvailability();
      const zones = allZones.filter((zone) => !input.zone || zone.id === input.zone);
      const matches = zones.flatMap((zone) =>
        zone.services
          .filter(
            (service) =>
              !input.service_query ||
              service.name.toLowerCase().includes(input.service_query.toLowerCase()),
          )
          .map((service) => ({
            zone: zone.id,
            service_id: service.id,
            name: service.name,
            availability: input.location_id
              ? {
                  [input.location_id]: service.availability[input.location_id] ?? {
                    status: "not-planned",
                  },
                }
              : service.availability,
          })),
      );
      const page = matches.slice(input.offset, input.offset + input.limit);
      return {
        total: matches.length,
        offset: input.offset,
        returned: page.length,
        ...(matches.length > input.offset + page.length ? { hint: NARROW_HINT } : {}),
        services: page,
        citation,
        ...(warnings.length > 0 ? { warnings } : {}),
      };
    },
  },
  {
    name: "atlas_get_context_bundle",
    description:
      "Fetch Atlas's governed context bundle for a topic_id, source_id, or free-text query. Every Excerpt is paired with its Citation; relay warnings (restricted_source, stale_source) verbatim.",
    inputSchema: toInputSchema(GetContextBundleInput),
    async run(args, client) {
      const input = GetContextBundleInput.parse(args ?? {});
      const { response_format, ...request } = input;
      const bundle = await client.getContextBundle(request);
      return response_format === "DETAILED" ? bundle : conciseBundle(bundle);
    },
  },
];

/**
 * Render a failed tool call as an actionable message with a correctly-formed
 * example input, per MCP tool-design best practice.
 */
export function toolErrorMessage(toolName: string, error: unknown): string {
  const example: Record<string, string> = {
    atlas_search_service: `{"query": "textract"}`,
    atlas_get_source: `{"source_id": "textract-module-readme"}`,
    atlas_get_availability: `{"zone": "aws", "service_query": "textract"}`,
    atlas_get_context_bundle: `{"topic_id": "aws-textract"}`,
  };
  const reason =
    error instanceof ContextApiError
      ? `${error.code}: ${error.message}`
      : error instanceof z.ZodError
        ? `invalid arguments: ${error.issues
            .map((issue) => `${issue.path.join(".") || "(root)"} ${issue.message}`)
            .join("; ")}`
        : error instanceof Error
          ? error.message
          : String(error);
  return `${toolName} failed — ${reason}. Example of a valid call: ${example[toolName] ?? "{}"}`;
}
