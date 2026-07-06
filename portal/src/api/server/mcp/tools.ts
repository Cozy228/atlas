/**
 * The curated, read-only MCP tool set over the Context API.
 *
 * Four namespaced tools mirror Atlas's reads — search-first, not
 * one-per-endpoint. Responses keep Atlas's semantic ids and always carry the
 * Citation; warnings are passed through verbatim. No write tool exists, by
 * decision (reads first; any future mutation needs audit + human confirm).
 */
import { z } from "zod";
import {
  ApiErrorResponseSchema,
  briefDepths,
  resourceKinds,
  type Brief,
  type ResourceContextResponse,
} from "@atlas/schema";
import { createResolutionContext, handleBriefRequest, type ScopeInput } from "@atlas/context-layer";

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

/** `atlas_explain_error` input → the debug brief FLOOR (Step 7, M7). The target
 *  `service` names the capability whose troubleshooting sections + operational
 *  locations the floor assembles (like adopt's `service`). The optional `error`
 *  is the operational error text you are investigating — it is NEVER interpreted
 *  server-side (P12/P15): the floor returns the capability's cited troubleshooting
 *  Evidence + the location index's pointers, and you correlate the error against
 *  them yourself (it may only narrow which cited sections you choose to read). */
const ExplainErrorInput = z.object({
  service: z
    .string()
    .min(1)
    .describe("Target service slug whose debug floor to assemble, e.g. 'aws/textract'."),
  error: z
    .string()
    .min(1)
    .optional()
    .describe(
      "Optional operational error text you are investigating. NOT interpreted server-side (P12/P15) — the floor never runs an LLM over it; it may only help you select which returned sections to read.",
    ),
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
  /** Inventory group (Step 5): `bootstrap` is the discovery door, `moment` tools are the
   *  thin brief wrappers, `atom` tools are the resource reads beneath them. `atlas_bootstrap`
   *  derives its grouped inventory from this discriminator, so it can never drift from the
   *  registered surface. */
  group: "bootstrap" | "moment" | "atom";
  description: string;
  inputSchema: Record<string, unknown>;
  /** The caller Bearer (ADR-0001) is threaded unparsed as the optional 3rd arg — the moment
   *  tools + bootstrap build the governed ctx with it; the resource atoms ignore it (they
   *  read through the already-Bearer-bound `client`). */
  run(args: unknown, client: ContextApiClient, bearer?: string): Promise<unknown>;
};

function toInputSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _discarded, ...jsonSchema } = z.toJSONSchema(schema, {
    io: "input",
  }) as Record<string, unknown> & { $schema?: string };
  return jsonSchema;
}

/**
 * Map the moment/bootstrap scope args onto Step 1's `ScopeInput` union (M11) — the SAME
 * mapping the governed router's `scopeFromQuery` performs, so a tool-built ctx and an
 * endpoint-built ctx are identical for the same scope (thin-wrapper equivalence, D2).
 * By-value `landingZones[]` (a P26 set) and/or a by-reference `appId`; supplying both
 * reconciles (value wins, `scope_drift` on disagreement). Absent ⇒ anonymous unscoped.
 */
function scopeInputFrom(args: {
  landingZones?: string[];
  appId?: string;
  services?: string[];
}): ScopeInput | undefined {
  const landingZones = (args.landingZones ?? []).filter((zone) => zone.length > 0);
  const appId = args.appId?.trim() || undefined;
  const services = args.services?.filter((service) => service.length > 0);
  const hasValue = landingZones.length > 0;
  const withServices = services && services.length > 0 ? { services } : {};
  if (hasValue && appId) {
    return { kind: "both", landingZones, appId, ...withServices };
  }
  if (hasValue) {
    return { kind: "by-value", landingZones, ...withServices };
  }
  if (appId) {
    return { kind: "by-reference", appId };
  }
  return undefined;
}

/** Unwrap a brief handler result into the one `Brief` value, surfacing the handler's honest
 *  error (locked decision 1: a tool error is the handler's error, passed through). */
function unwrapBrief(result: { status: number; body: unknown }): Brief {
  if (result.status >= 400) {
    const parsed = ApiErrorResponseSchema.safeParse(result.body);
    if (parsed.success) {
      throw ContextApiError.fromResponse({ status: result.status, body: parsed.data });
    }
    throw new ContextApiError({
      code: "invalid_request",
      message: `Context API returned status ${result.status} with no structured error body.`,
      status: result.status,
    });
  }
  return result.body as Brief;
}

/**
 * The thin-wrapper core (P13/I3): build the governed ctx from the tool's scope args + the
 * caller Bearer, then call `handleBriefRequest` — the SAME code path as
 * `GET /api/briefs/{moment}`, never a second assembly. `depth` defaults inside the handler
 * (API face = citations, M9); `service`/`since` ride the handler options.
 */
async function briefFromArgs(
  moment: string,
  args: { landingZones?: string[]; appId?: string; depth?: (typeof briefDepths)[number] },
  bearer: string | undefined,
  options: { service?: string; since?: string } = {},
): Promise<Brief> {
  const ctx = await createResolutionContext({
    identity: { bearer },
    scope: scopeInputFrom(args),
  });
  const result = await handleBriefRequest(moment, ctx, {
    service: options.service,
    since: options.since,
    depth: args.depth,
  });
  return unwrapBrief(result);
}

/** The depth contract statement `atlas_bootstrap` publishes (M9/P28). */
const DEPTH_STATEMENT =
  "Moment tools default to depth=citations: structure + citations, no excerpt bodies — " +
  'follow a citation to atlas_get_resource_context for the body. Pass depth="excerpts" to ' +
  "have the resolved section bodies inlined (you pay the token cost explicitly).";

/** Tools that exist behind the door but are not yet callable — listed honestly, never
 *  fabricated as a stub (locked decision 5). Empty since Step 7: `atlas_explain_error`
 *  landed as the debug-moment M7 floor (reviewer ruling 2026-07-07 — the goal-prompt
 *  Seam clause retires the Step-5 not-yet-available mile-marker). */
const NOT_YET_AVAILABLE: { name: string; reason: string }[] = [];

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
    group: "atom",
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
    group: "atom",
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
    group: "atom",
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
    group: "atom",
    description:
      "Fetch Atlas's live resource projection (governed Sections + reference-only discovery links) for a {kind, slug}. Every Section's content is paired with its Citations; relay warnings (restricted_source, stale_source) verbatim.",
    inputSchema: toInputSchema(GetResourceContextInput),
    async run(args, client) {
      const input = GetResourceContextInput.parse(args ?? {});
      const projection = await client.getResourceContext(input.kind, input.slug);
      return input.response_format === "DETAILED" ? projection : conciseProjection(projection);
    },
  },
  // --- Step 5 moment-first front door ---------------------------------------
  // The moment tools are thin wrappers over the Step-4/7 brief handlers — the
  // SAME code path (P13/I3, via createResolutionContext + handleBriefRequest),
  // never a second assembly — and `atlas_bootstrap` is identity/scope discovery +
  // tool inventory (I6). All read-only. `atlas_explain_error` is the Step-7 debug
  // moment (M7 floor), registered here as a thin wrap over `handleBriefRequest("debug")`.
  {
    name: "atlas_bootstrap",
    group: "bootstrap",
    description:
      "Start here. Resolve who you are in Atlas — your landing-zone set, its origin (by-value manifest vs by-reference appId), and any scope warnings (scope_drift / scope_unresolved) — and discover the available moment tools, the resource atoms beneath them, and the depth contract. Identity/scope discovery only: a by-value scope never writes, and no registration is triggered.",
    inputSchema: toInputSchema(BootstrapInput),
    async run(args, _client, bearer) {
      const input = BootstrapInput.parse(args ?? {});
      // Build the governed ctx directly (mirroring inProcessContextApi): bootstrap needs
      // the vetting warnings the ContextApiClient does not expose. A by-value scope NEVER
      // writes (M11) — vetScope seats it verbatim and consults no store.
      const ctx = await createResolutionContext({
        identity: { bearer },
        scope: scopeInputFrom(input),
      });
      const situation = {
        landingZoneIds: ctx.scope?.landingZoneIds ?? [],
        origin: ctx.scope?.origin ?? "by-value",
        ...(ctx.scope?.appId ? { appId: ctx.scope.appId } : {}),
        warnings: ctx.warnings.map((warning) => ({
          code: warning.code,
          message: warning.message,
        })),
      };
      return {
        situation,
        // The inventory is derived from the registry (grouped moment-tools-then-atoms),
        // never a hardcoded list that can drift from the registered surface.
        tools: {
          moments: mcpTools.filter((tool) => tool.group === "moment").map((tool) => tool.name),
          atoms: mcpTools.filter((tool) => tool.group === "atom").map((tool) => tool.name),
        },
        depth: { default: "citations", statement: DEPTH_STATEMENT },
        notYetAvailable: NOT_YET_AVAILABLE,
      };
    },
  },
  {
    name: "atlas_check_adoption",
    group: "moment",
    description:
      "The adopt moment: what a service needs before you take it on, for your landing zones. A thin wrapper over the adopt brief handler (same code path as GET /api/briefs/adopt); returns the one serialized Brief value (default depth=citations — follow citations to atlas_get_resource_context for bodies).",
    inputSchema: toInputSchema(CheckAdoptionInput),
    async run(args, _client, bearer) {
      const input = CheckAdoptionInput.parse(args ?? {});
      return briefFromArgs("adopt", input, bearer, { service: input.service });
    },
  },
  {
    name: "atlas_get_my_context",
    group: "moment",
    description:
      "The build moment: your resolved platform context for your app across your landing zones. A thin wrapper over the build brief handler (same code path as GET /api/briefs/build); returns the one serialized Brief value (default depth=citations).",
    inputSchema: toInputSchema(GetMyContextInput),
    async run(args, _client, bearer) {
      const input = GetMyContextInput.parse(args ?? {});
      return briefFromArgs("build", input, bearer);
    },
  },
  {
    name: "atlas_whats_changed",
    group: "moment",
    description:
      "The change moment: what changed in your scope, optionally since a cursor. A thin wrapper over the change brief handler over the Step-2 derived feed (same code path as GET /api/briefs/change); returns the one serialized Brief value (default depth=citations). This is the machine-derived feed, never the editorial What's New.",
    inputSchema: toInputSchema(WhatsChangedInput),
    async run(args, _client, bearer) {
      const input = WhatsChangedInput.parse(args ?? {});
      return briefFromArgs("change", input, bearer, { since: input.since });
    },
  },
  {
    name: "atlas_explain_error",
    group: "moment",
    description:
      "The debug moment (M7): the operational floor for a capability — its cited troubleshooting Evidence PLUS where its things live (the location index's pointers). A thin wrapper over the debug brief handler (same code path as GET /api/briefs/debug); returns the one serialized Brief value (default depth=citations). Pass the `error` you are investigating as context — it is NOT interpreted server-side (P12/P15); you correlate it against the returned Evidence + locations yourself.",
    inputSchema: toInputSchema(ExplainErrorInput),
    async run(args, _client, bearer) {
      const input = ExplainErrorInput.parse(args ?? {});
      // Thin wrap over the SAME `handleBriefRequest("debug")` seam the /api and the
      // Portal faces use — never a second assembly. `error` is accepted but never
      // interpreted server-side (P12/P15): it does not reach the handler.
      return briefFromArgs("debug", input, bearer, { service: input.service });
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
    atlas_explain_error: `{"service": "aws/textract", "landingZones": ["awsf"]}`,
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
