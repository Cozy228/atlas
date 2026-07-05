/**
 * The curated, read-only MCP tool set over the Context API.
 *
 * Four namespaced tools mirror Atlas's reads — search-first, not
 * one-per-endpoint. Responses keep Atlas's semantic ids and always carry the
 * Citation; warnings are passed through verbatim. No write tool exists, by
 * decision (reads first; any future mutation needs audit + human confirm).
 */
import { z } from "zod";
import { briefDepths, resourceKinds, type ResourceContextResponse } from "@atlas/schema";

import type { ContextApiClient } from "../../contextApiClient";
import { ContextApiError } from "../../contextApiError";
import { unimplemented } from "./unimplemented";

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

/**
 * The moment-tool scope args (Step 5, M11): by-value `landingZones[]` (a P26 set —
 * plural from the first line, a hardcoded singular zone is a defect) and/or a
 * by-reference `appId`. Both are optional; supplying both reconciles them (the
 * by-value declaration wins, `scope_drift` on disagreement). By-value never
 * writes — no registration is triggered by any tool call.
 */
const ScopeArgs = {
  landingZones: z
    .array(z.string().min(1))
    .optional()
    .describe("Landing-zone id SET (P26), e.g. ['awsf','azuref']. By-value scope — never writes."),
  appId: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Registered AppRecord id (by-reference scope). With landingZones, both reconcile: the by-value declaration wins and a scope_drift warning is surfaced on disagreement.",
    ),
};

/** The depth contract (M9/P28): moment tools default to `citations` (structure +
 *  citations, no excerpt bodies — the agent face is consumable without paying the
 *  excerpt cost); `excerpts` adds the resolved bodies. Explicit arg, never the
 *  default on the agent face. */
const DepthArg = {
  depth: z
    .enum(briefDepths)
    .optional()
    .describe(
      "citations (default): structure + citations, no excerpt bodies. excerpts: adds resolved section bodies (the agent pays the token cost explicitly).",
    ),
};

/** `atlas_bootstrap` input (locked decision 3): optional by-value scope
 *  (`landingZones[]`, `services[]`) and/or `appId`. Identity/scope discovery +
 *  tool inventory only — no depth, no writes. */
const BootstrapInput = z.object({
  ...ScopeArgs,
  services: z
    .array(z.string().min(1))
    .optional()
    .describe("Declared service slugs in use (by-value manifest set), e.g. ['aws/textract']."),
});

/** `atlas_check_adoption` input → the adopt brief. The target `service` is
 *  required and rides the scope into the brief handler (`?service=`). */
const CheckAdoptionInput = z.object({
  service: z
    .string()
    .min(1)
    .describe("Target service slug to check adoption for, e.g. 'aws/textract'."),
  ...ScopeArgs,
  ...DepthArg,
});

/** `atlas_get_my_context` input → the build brief for the resolved situation. */
const GetMyContextInput = z.object({
  ...ScopeArgs,
  ...DepthArg,
});

/** `atlas_whats_changed` input → the change brief over the Step-2 derived feed.
 *  `since` threads the incremental cursor (M8). */
const WhatsChangedInput = z.object({
  ...ScopeArgs,
  since: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Opaque incremental cursor from a prior whats_changed result; omit for the full scoped feed.",
    ),
  ...DepthArg,
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
                // Description is content-derived (a module README's lead paragraph),
                // so it is absent from the list/search surface until a detail read
                // (plan 0.2.0 list-only discovery) — omit it rather than emit null.
                ...(resource.description ? { description: resource.description } : {}),
              })),
      };
    },
  },
  {
    name: "atlas_get_source",
    description:
      "Get one registered Source's registry record (class, review cadence, freshness) by source_id. Read its cited content through the resource that binds it via atlas_get_resource_context.",
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
  // --- Step 5 moment-first front door (Batch 0: signatures throwing) --------
  // The three moment tools are thin wrappers over the Step-4 brief handlers —
  // the SAME code path (P13/I3), never a second assembly — and `atlas_bootstrap`
  // is identity/scope discovery + tool inventory (I6). All read-only. Registered
  // now so they are visible in tools/list; their `run` throws `unimplemented`
  // until Batch 1/2 lands the behavior. `explain_error` is Step 7 — deliberately
  // NOT registered (locked decision 5); `atlas_bootstrap` lists it not-yet-available.
  {
    name: "atlas_bootstrap",
    description:
      "Start here. Resolve who you are in Atlas — your landing-zone set, its origin (by-value manifest vs by-reference appId), and any scope warnings (scope_drift / scope_unresolved) — and discover the available moment tools, the resource atoms beneath them, and the depth contract. Identity/scope discovery only: a by-value scope never writes, and no registration is triggered.",
    inputSchema: toInputSchema(BootstrapInput),
    async run(_args, _client) {
      unimplemented("atlas_bootstrap");
    },
  },
  {
    name: "atlas_check_adoption",
    description:
      "The adopt moment: what a service needs before you take it on, for your landing zones. A thin wrapper over the adopt brief handler (same code path as GET /api/briefs/adopt); returns the one serialized Brief value (default depth=citations — follow citations to atlas_get_resource_context for bodies).",
    inputSchema: toInputSchema(CheckAdoptionInput),
    async run(_args, _client) {
      unimplemented("atlas_check_adoption");
    },
  },
  {
    name: "atlas_get_my_context",
    description:
      "The build moment: your resolved platform context for your app across your landing zones. A thin wrapper over the build brief handler (same code path as GET /api/briefs/build); returns the one serialized Brief value (default depth=citations).",
    inputSchema: toInputSchema(GetMyContextInput),
    async run(_args, _client) {
      unimplemented("atlas_get_my_context");
    },
  },
  {
    name: "atlas_whats_changed",
    description:
      "The change moment: what changed in your scope, optionally since a cursor. A thin wrapper over the change brief handler over the Step-2 derived feed (same code path as GET /api/briefs/change); returns the one serialized Brief value (default depth=citations). This is the machine-derived feed, never the editorial What's New.",
    inputSchema: toInputSchema(WhatsChangedInput),
    async run(_args, _client) {
      unimplemented("atlas_whats_changed");
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
    atlas_bootstrap: `{"landingZones": ["awsf"]}`,
    atlas_check_adoption: `{"service": "aws/textract", "landingZones": ["awsf"]}`,
    atlas_get_my_context: `{"landingZones": ["awsf"]}`,
    atlas_whats_changed: `{"landingZones": ["awsf"]}`,
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
