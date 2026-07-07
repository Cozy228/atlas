/**
 * Atlas Context API server functions.
 *
 * These are the loader-facing RPC entry points for the Portal. The factory
 * functions are isomorphic, but the underlying `serverContextApiClient`
 * import is server-only. Browser code never reaches the in-process Context
 * Layer; it always invokes one of these server functions.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import {
  SourceDiscoveryRequestSchema,
  moments,
  type AvailabilityResponse,
  type Brief,
  type BriefDepth,
  type ChangesResponse,
  type InstrumentsResponse,
  type LandingZone,
  type Moment,
  type SourceDiscoveryRequest,
} from "@atlas/schema";
import { LANDING_ZONES, handleInstrumentsRequest } from "@atlas/context-layer";
import { z } from "zod";

import { createServerContextApiClient } from "./httpContextApiClient";
import { resolveDataMode } from "./dataMode";
import { mockChangesFeed } from "./changesMock";
import { mockBrief } from "./briefsMock";

/**
 * Build a Context API client for the current request, forwarding whatever
 * Bearer token the caller supplied. The token is read from the incoming
 * `Authorization` header and threaded down; on the HTTP path it is re-attached
 * as `Authorization: Bearer <token>`, and on the in-process path it is ignored
 * (offline). The token never crosses into any browser-facing payload.
 */
function contextApiForRequest() {
  return createServerContextApiClient({ token: callerBearerToken() });
}

function callerBearerToken(): string | undefined {
  let header: string | undefined;
  try {
    header = getRequestHeader("authorization");
  } catch {
    // No active request context (e.g. non-HTTP invocation) — fall back offline.
    return undefined;
  }
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}

/**
 * Strict output validation is disabled because every response is already
 * parsed through the shared Zod schema in `serverContextApiClient`, which
 * guarantees runtime serializability. We keep input strictness so the
 * server function still rejects malformed loader payloads.
 */
const SERVER_FN_OPTIONS = { method: "GET", strict: { output: false } } as const;

const idSchema = z.string().min(1);

export const fetchSource = createServerFn(SERVER_FN_OPTIONS)
  .validator((input: unknown): string => idSchema.parse(input))
  .handler(async ({ data }) => contextApiForRequest().getSource(data));

/**
 * The Explore availability grid, read through the one cited Context Layer
 * availability read (plan 014). Drops the read's citation/warnings and returns
 * just the `{ zones }` wire shape the Explore + catalog consumers depend on.
 */
// Process-level memo for the availability read, keyed by scope. The in-process
// availability path fetches through an UNcached live fetch (unlike the
// release-notes path, which uses the shared source-content cache), so without
// this every full-page refresh (a fresh per-request queryClient) would re-pay
// the live Confluence fetch + dev latency. Memoizing the response here gives
// availability the same "first read is slow, every refresh is instant" behaviour
// the cached paths already have. TTL mirrors the source-content cache (5 min);
// the client's React Query cache covers intra-session navigation on top of this.
const AVAILABILITY_MEMO_MS = 5 * 60_000;
const availabilityMemo = new Map<string, { at: number; data: AvailabilityResponse }>();

// By-value availability scope (Step 3 decision 7/8): the situation's landing-zone
// set, threaded from the Portal APP selector so a scoped answer is produced by
// SERVER code, not client-side filtering. Absent ⇒ the full topology (LZ-only).
const availabilityScopeSchema = z
  .object({ landingZones: z.array(z.string().min(1)).min(1).optional() })
  .optional();

export const fetchAvailability = createServerFn(SERVER_FN_OPTIONS)
  .validator((input: unknown) => availabilityScopeSchema.parse(input))
  .handler(async ({ data: scope }): Promise<AvailabilityResponse> => {
    const key = scope?.landingZones?.length ? scope.landingZones.join(",") : "";
    const now = Date.now();
    const cached = availabilityMemo.get(key);
    if (cached && now - cached.at < AVAILABILITY_MEMO_MS) {
      return cached.data;
    }
    const { zones } = await contextApiForRequest().getAvailability(
      scope?.landingZones?.length ? { landingZones: scope.landingZones } : undefined,
    );
    const data: AvailabilityResponse = { zones };
    availabilityMemo.set(key, { at: now, data });
    return data;
  });

// The per-scope derived change feed (Step 2, M8). Scope is the situation's
// landing-zone set (by value) and/or `appId`; `since` is the incremental cursor.
// In mock mode a deterministic fixture feed renders the surface; live reads the
// real derived feed through the governed router.
const changesScopeSchema = z
  .object({
    landingZones: z.array(z.string().min(1)).min(1).optional(),
    appId: z.string().min(1).optional(),
    since: z.string().min(1).optional(),
  })
  .optional();

export const fetchChanges = createServerFn(SERVER_FN_OPTIONS)
  .validator((input: unknown) => changesScopeSchema.parse(input))
  .handler(async ({ data }): Promise<ChangesResponse> => {
    if (resolveDataMode() === "mock") {
      return mockChangesFeed({ landingZones: data?.landingZones, since: data?.since });
    }
    const scope =
      data?.landingZones?.length || data?.appId
        ? { landingZones: data?.landingZones, appId: data?.appId }
        : undefined;
    return contextApiForRequest().getChanges(scope, data?.since);
  });

// The one serialized moment Brief (Step 4, I3/M9). Scope is the situation's
// landing-zone set (by value) and/or `appId`, plus the adopt/build target
// `service` and the change `since` cursor. The Portal human render asks
// `excerpts` explicitly (mid-level §3); in mock mode a deterministic fixture
// Brief renders the surface, live assembles the real value through the router.
const briefRequestSchema = z.object({
  moment: z.enum(moments),
  landingZones: z.array(z.string().min(1)).min(1).optional(),
  appId: z.string().min(1).optional(),
  service: z.string().min(1).optional(),
  since: z.string().min(1).optional(),
  depth: z.enum(["citations", "excerpts"]).optional(),
});

export const fetchBrief = createServerFn(SERVER_FN_OPTIONS)
  .validator((input: unknown) => briefRequestSchema.parse(input))
  .handler(async ({ data }): Promise<Brief> => {
    const depth: BriefDepth = data.depth ?? "excerpts";
    if (resolveDataMode() === "mock") {
      return mockBrief(data.moment as Moment, {
        landingZones: data.landingZones,
        service: data.service,
      });
    }
    const scope =
      data.landingZones?.length || data.appId || data.service
        ? { landingZones: data.landingZones, appId: data.appId, service: data.service }
        : undefined;
    return contextApiForRequest().getBrief(data.moment, scope, depth);
  });

/**
 * The landing-zone topology (plan 021 G3, ADR-0017) — the discovery root's LZ
 * list, served to the Portal's current-LZ selector. Lightweight (no availability
 * fetch): just id/name/cloud/dataStatus, so the top-nav dropdown paints
 * immediately and the unwired LZs (`dataStatus: "not-available"`) are listed, not
 * hidden — an honest dead-end on selection, never another LZ's data (ADR-0006).
 */
export const fetchLandingZones = createServerFn(SERVER_FN_OPTIONS).handler(
  async (): Promise<LandingZone[]> => LANDING_ZONES.map((zone) => ({ ...zone })),
);

const resourceRefSchema = z.object({ kind: z.string().min(1), slug: z.string().min(1) });

export const fetchResourceContext = createServerFn(SERVER_FN_OPTIONS)
  .validator((input: unknown) => resourceRefSchema.parse(input))
  .handler(async ({ data }) => {
    // Live resource projection (plan 017): governed sections + reference-only
    // discovery links. Dev latency comes from the MSW seam (cache-respecting), not
    // a flat per-call delay — so the first read is slow and a revisit is instant.
    return contextApiForRequest().getResourceContext(data.kind, data.slug);
  });

export const fetchResourceRecord = createServerFn(SERVER_FN_OPTIONS)
  .validator((input: unknown) => resourceRefSchema.parse(input))
  // Presentation metadata (plan 020 15d): identity/owner/entry fields. Durable
  // (no live fetch), so it is awaited for the page shell — no dev delay.
  .handler(async ({ data }) => contextApiForRequest().getResourceRecord(data.kind, data.slug));

export const fetchResourceCatalog = createServerFn(SERVER_FN_OPTIONS).handler(async () =>
  contextApiForRequest().discoverResources(),
);

export const fetchSourceDiscovery = createServerFn(SERVER_FN_OPTIONS)
  .validator(
    (input: unknown): SourceDiscoveryRequest => SourceDiscoveryRequestSchema.parse(input ?? {}),
  )
  .handler(async ({ data }) => contextApiForRequest().discoverSources(data));

/**
 * The honesty-instruments dashboard read (Step 6, D6): the since-boot metrics
 * registry snapshot + change-feed volume by class + the negotiation queue. Read
 * directly from the in-process context layer (aggregate counts only, no identity)
 * — the same value the internal `GET /api/internal/instruments` endpoint serves.
 */
export const fetchInstruments = createServerFn(SERVER_FN_OPTIONS).handler(
  async (): Promise<InstrumentsResponse> => {
    const result = await handleInstrumentsRequest(process.env);
    return result.body;
  },
);
