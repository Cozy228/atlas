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
  type AvailabilityResponse,
  type LandingZone,
  type SourceDiscoveryRequest,
} from "@atlas/schema";
import { LANDING_ZONES } from "@atlas/context-layer";
import { z } from "zod";

import { createServerContextApiClient } from "./httpContextApiClient";

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
// Process-level memo for the availability read. The in-process availability path
// fetches through an UNcached live fetch (unlike the release-notes path, which
// uses the shared source-content cache), so without this every full-page refresh
// (a fresh per-request queryClient) would re-pay the live Confluence fetch + dev
// latency. Memoizing the response here gives availability the same "first read is
// slow, every refresh is instant" behaviour the cached paths already have. TTL
// mirrors the source-content cache (5 min); the client's React Query cache covers
// intra-session navigation on top of this.
const AVAILABILITY_MEMO_MS = 5 * 60_000;
let availabilityMemo: { at: number; data: AvailabilityResponse } | undefined;

export const fetchAvailability = createServerFn(SERVER_FN_OPTIONS).handler(
  async (): Promise<AvailabilityResponse> => {
    const now = Date.now();
    if (availabilityMemo && now - availabilityMemo.at < AVAILABILITY_MEMO_MS) {
      return availabilityMemo.data;
    }
    const { zones } = await contextApiForRequest().getAvailability();
    const data: AvailabilityResponse = { zones };
    availabilityMemo = { at: now, data };
    return data;
  },
);

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
