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
  ContextRequestSchema,
  SourceDiscoveryRequestSchema,
  TopicDiscoveryRequestSchema,
  type ContextRequest,
  type SourceDiscoveryRequest,
  type TopicDiscoveryRequest,
} from "@atlas/schema";
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

export const fetchTopic = createServerFn(SERVER_FN_OPTIONS)
  .validator((input: unknown): string => idSchema.parse(input))
  .handler(async ({ data }) => contextApiForRequest().getTopic(data));

export const fetchSource = createServerFn(SERVER_FN_OPTIONS)
  .validator((input: unknown): string => idSchema.parse(input))
  .handler(async ({ data }) => contextApiForRequest().getSource(data));

export const fetchContextBundle = createServerFn(SERVER_FN_OPTIONS)
  .validator((input: unknown): ContextRequest => ContextRequestSchema.parse(input))
  .handler(async ({ data }) => {
    // Simulate the resolver's real live fetch + parse of each cited anchor (e.g.
    // Confluence pages) so the deferred detail-page skeletons are visible in dev.
    // Dev-only: dropped from prod builds, and moot once the resolver hits real
    // external systems. Only the bundle is delayed — discovery (source/topic
    // lists) is awaited synchronously in loaders and must stay fast.
    if (import.meta.env.DEV) await new Promise((resolve) => setTimeout(resolve, 2000));
    return contextApiForRequest().getContextBundle(data);
  });

export const fetchTopicDiscovery = createServerFn(SERVER_FN_OPTIONS)
  .validator(
    (input: unknown): TopicDiscoveryRequest => TopicDiscoveryRequestSchema.parse(input ?? {}),
  )
  .handler(async ({ data }) => contextApiForRequest().discoverTopics(data));

export const fetchSourceDiscovery = createServerFn(SERVER_FN_OPTIONS)
  .validator(
    (input: unknown): SourceDiscoveryRequest => SourceDiscoveryRequestSchema.parse(input ?? {}),
  )
  .handler(async ({ data }) => contextApiForRequest().discoverSources(data));
