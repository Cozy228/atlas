import type { McpServer, ServerContext } from "@modelcontextprotocol/server";
import { logger } from "@atlas/logging";
import {
  AvailabilityReadResponseSchema,
  LocationAvailabilitySchema,
  ResourceContextResponseSchema,
  SearchContextInputSchema,
  SearchContextResponseSchema,
  SectionIdSchema,
  resourceKinds,
} from "@atlas/schema";
import { z } from "zod";

import { createDefaultContextService } from "../composition";
import { getResourceContext } from "../resources/resourceContextService";
import { searchContext } from "../search/searchContext";
import { readAvailability } from "../services/availabilityReadService";
import { resolutionContextFromHeaders } from "../api/requestResolutionContext";

const log = logger("context-layer.mcp");

const ReadContextInputSchema = z
  .object({
    resource_id: z
      .string()
      .min(3)
      .describe("Canonical Atlas resource id, e.g. service/aws/textract."),
    sections: z.array(SectionIdSchema).min(1).optional(),
  })
  .strict();

const CheckAvailabilityInputSchema = z
  .object({
    service_query: z.string().trim().min(1),
    zone: z.string().trim().min(1).optional(),
    location_id: z.string().trim().min(1).optional(),
    limit: z.number().int().min(1).max(50).default(10),
  })
  .strict();

const AvailabilityToolOutputSchema = z
  .object({
    total: z.number().int().nonnegative(),
    returned: z.number().int().nonnegative(),
    truncated: z.boolean(),
    services: z.array(
      z
        .object({
          zone: z.string().min(1),
          service_id: z.string().min(1),
          name: z.string().min(1),
          availability: z.record(z.string(), LocationAvailabilitySchema),
        })
        .strict(),
    ),
    citation: AvailabilityReadResponseSchema.shape.citation,
    warnings: AvailabilityReadResponseSchema.shape.warnings,
  })
  .strict();

const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

export const ATLAS_MCP_TOOL_SUMMARIES = [
  {
    name: "atlas_search_context",
    description:
      "Search registered Atlas resource, Source, and Anchor metadata by keywords, then return bounded, live-resolved governed excerpts with citations. Start here when the canonical resource id is unknown.",
  },
  {
    name: "atlas_read_context",
    description:
      "Read selected governed Sections for one canonical Atlas resource id, preserving citations and source warnings.",
  },
  {
    name: "atlas_check_availability",
    description:
      "Check cited regional availability for platform services by service keyword, landing zone, or location.",
  },
] as const;

export function registerAtlasMcpTools(server: McpServer): void {
  server.registerTool(
    ATLAS_MCP_TOOL_SUMMARIES[0].name,
    {
      description: ATLAS_MCP_TOOL_SUMMARIES[0].description,
      inputSchema: SearchContextInputSchema,
      outputSchema: SearchContextResponseSchema,
      annotations: TOOL_ANNOTATIONS,
    },
    async (input, ctx) =>
      toolCall(ATLAS_MCP_TOOL_SUMMARIES[0].name, async () => {
        const service = await createDefaultContextService();
        return searchContext(service, input, await requestResolutionContext(ctx));
      }),
  );

  server.registerTool(
    ATLAS_MCP_TOOL_SUMMARIES[1].name,
    {
      description: ATLAS_MCP_TOOL_SUMMARIES[1].description,
      inputSchema: ReadContextInputSchema,
      outputSchema: ResourceContextResponseSchema,
      annotations: TOOL_ANNOTATIONS,
    },
    async ({ resource_id: resourceId, sections }, ctx) =>
      toolCall(ATLAS_MCP_TOOL_SUMMARIES[1].name, async () => {
        const [kind, ...slugParts] = resourceId.split("/");
        const slug = slugParts.join("/");
        if (!resourceKinds.includes(kind as (typeof resourceKinds)[number]) || !slug) {
          throw new Error(
            `Invalid resource_id '${resourceId}'. Expected {kind}/{slug}, e.g. service/aws/textract.`,
          );
        }
        const service = await createDefaultContextService();
        const projection = await getResourceContext(
          service,
          { kind: kind as (typeof resourceKinds)[number], slug, sections },
          await requestResolutionContext(ctx),
        );
        if (!projection) {
          throw new Error(
            `Atlas resource '${resourceId}' was not found. Call atlas_search_context.`,
          );
        }
        return projection;
      }),
  );

  server.registerTool(
    ATLAS_MCP_TOOL_SUMMARIES[2].name,
    {
      description: ATLAS_MCP_TOOL_SUMMARIES[2].description,
      inputSchema: CheckAvailabilityInputSchema,
      outputSchema: AvailabilityToolOutputSchema,
      annotations: TOOL_ANNOTATIONS,
    },
    async (input) =>
      toolCall(ATLAS_MCP_TOOL_SUMMARIES[2].name, async () => {
        const service = await createDefaultContextService();
        const read = await readAvailability(service);
        const query = input.service_query.toLowerCase();
        const matches = read.zones
          .filter((zone) => !input.zone || zone.id === input.zone)
          .flatMap((zone) =>
            zone.services
              .filter(
                (service) =>
                  service.id.toLowerCase().includes(query) ||
                  service.name.toLowerCase().includes(query),
              )
              .map((service) => ({
                zone: zone.id,
                service_id: service.id,
                name: service.name,
                availability: input.location_id
                  ? {
                      [input.location_id]: service.availability[input.location_id] ?? {
                        status: "not-planned" as const,
                      },
                    }
                  : service.availability,
              })),
          );
        return {
          total: matches.length,
          returned: Math.min(matches.length, input.limit),
          truncated: matches.length > input.limit,
          services: matches.slice(0, input.limit),
          citation: read.citation,
          warnings: read.warnings,
        };
      }),
  );
}

async function requestResolutionContext(ctx: ServerContext) {
  return resolutionContextFromHeaders(ctx.http?.req?.headers);
}

async function toolCall<T extends Record<string, unknown>>(
  toolName: string,
  run: () => Promise<T>,
): Promise<
  | { content: [{ type: "text"; text: string }]; structuredContent: T }
  | { content: [{ type: "text"; text: string }]; isError: true }
> {
  const startedAt = Date.now();
  try {
    const result = await run();
    log.info(
      {
        event: "mcp.tool.completed",
        toolName,
        outcome: "success",
        durationMs: Date.now() - startedAt,
      },
      "MCP tool completed",
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn(
      {
        event: "mcp.tool.completed",
        toolName,
        outcome: "error",
        durationMs: Date.now() - startedAt,
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
      "MCP tool failed",
    );
    return { content: [{ type: "text", text: message }], isError: true };
  }
}
