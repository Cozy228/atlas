/**
 * The curated, read-only MCP tool set over the Context API.
 *
 * Four namespaced tools mirror Atlas's reads — search-first, not
 * one-per-endpoint. Responses keep Atlas's semantic ids and always carry the
 * Citation; warnings are passed through verbatim. No write tool exists, by
 * decision (reads first; any future mutation needs audit + human confirm).
 */
import { z } from "zod";
import { resourceKinds, type ResourceContextResponse } from "@atlas/schema";

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

/** Cap any single Section's content so a projection stays under the budget. */
const CONCISE_EXCERPT_CHARS = 1500;

const NARROW_HINT = "Result was truncated; narrow your search (add query terms or filters).";

const SearchServiceInput = z.object({
  query: z.string().min(1).optional().describe("Free-text search, e.g. 'textract ocr'."),
  kind: z.enum(resourceKinds).optional().describe("Filter by kind: service or guardrail."),
  category: z.string().min(1).optional(),
  response_format: ResponseFormatSchema,
  ...PageSchema,
});

const GetSourceInput = z.object({
  source_id: z.string().min(1).describe("Registered Source id, e.g. 'textract-module-readme'."),
  response_format: ResponseFormatSchema,
});

const GetAvailabilityInput = z.object({
  zone: z
    .string()
    .min(1)
    .optional()
    .describe("Landing zone id to inspect (e.g. awsf); omit for all."),
  service_query: z.string().min(1).optional().describe("Filter services by name."),
  location_id: z.string().min(1).optional().describe("One region/outpost id, e.g. 'us-east-1'."),
  ...PageSchema,
});

const GetResourceContextInput = z.object({
  kind: z.enum(resourceKinds).describe("Resource kind: service, guardrail, or landing-zone."),
  slug: z
    .string()
    .min(1)
    .describe(
      "Kind-relative slug, e.g. 'aws/textract'. A service slug is {provider}/{service_id} from atlas_get_availability.",
    ),
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

function conciseProjection(projection: ResourceContextResponse) {
  let truncated = false;
  const sections = Object.entries(projection.sections).map(([id, section]) => {
    const content = section.content ?? "";
    if (content.length > CONCISE_EXCERPT_CHARS) {
      truncated = true;
    }
    return {
      section: id,
      status: section.status,
      content: content.slice(0, CONCISE_EXCERPT_CHARS),
      citations: section.citations,
      ...(section.warnings.length > 0 ? { warnings: section.warnings } : {}),
    };
  });
  return {
    resource: projection.resource.id,
    sections,
    references: projection.references,
    ...(projection.missingSections.length > 0
      ? { missing_sections: projection.missingSections }
      : {}),
    ...(truncated ? { truncated, hint: NARROW_HINT } : {}),
  };
}

export const mcpTools: McpToolDefinition[] = [
  {
    name: "atlas_search_service",
    description:
      "Search Atlas's registered resources (services and security policies) by free text. Start here to resolve a question to a resource, then read its context via atlas_get_resource_context.",
    inputSchema: toInputSchema(SearchServiceInput),
    async run(args, client) {
      const input = SearchServiceInput.parse(args ?? {});
      // The discovery-derived catalog returns every resource in one read; narrow
      // it here by free-text query, kind, and category.
      const { resources } = await client.discoverResources();
      // Tokenize the free-text query and match on ANY token, so a multi-word
      // query ("textract ocr") still hits a resource that contains only one term.
      const tokens = (input.query ?? "")
        .toLowerCase()
        .split(/[^a-z0-9-]+/)
        .filter((token) => token.length >= 2);
      const matches = resources.filter((resource) => {
        if (input.kind && resource.kind !== input.kind) return false;
        if (input.category && resource.category !== input.category) return false;
        if (tokens.length === 0) return true;
        const haystack = [
          resource.name,
          ...resource.aliases,
          resource.slug,
          resource.description ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return tokens.some((token) => haystack.includes(token));
      });
      const page = matches.slice(input.offset, input.offset + input.limit);
      return {
        total: matches.length,
        offset: input.offset,
        returned: page.length,
        ...(matches.length > input.offset + page.length ? { hint: NARROW_HINT } : {}),
        resources:
          input.response_format === "DETAILED"
            ? page
            : page.map((resource) => ({
                id: resource.id,
                name: resource.name,
                kind: resource.kind,
                description: resource.description,
              })),
      };
    },
  },
  {
    name: "atlas_get_source",
    description:
      "Get one registered Source's registry record (steward, review cadence, freshness) by source_id. Read its cited content through the resource that binds it via atlas_get_resource_context.",
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
    name: "atlas_get_resource_context",
    description:
      "Fetch Atlas's live resource projection (governed Sections + reference-only discovery links) for a {kind, slug}. Every Section's content is paired with its Citations; relay warnings (restricted_source, stale_source) verbatim.",
    inputSchema: toInputSchema(GetResourceContextInput),
    async run(args, client) {
      const input = GetResourceContextInput.parse(args ?? {});
      const projection = await client.getResourceContext(input.kind, input.slug);
      return input.response_format === "DETAILED" ? projection : conciseProjection(projection);
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
    atlas_get_availability: `{"zone": "awsf", "service_query": "textract"}`,
    atlas_get_resource_context: `{"kind": "service", "slug": "aws/textract"}`,
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
