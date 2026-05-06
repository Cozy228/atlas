/**
 * Atlas Context API server functions.
 *
 * These are the loader-facing RPC entry points for the Portal. The factory
 * functions are isomorphic, but the underlying `serverContextApiClient`
 * import is server-only. Browser code never reaches the in-process Context
 * Layer; it always invokes one of these server functions.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  ContextRequestSchema,
  SourceDiscoveryRequestSchema,
  TopicDiscoveryRequestSchema,
  type ContextRequest,
  type SourceDiscoveryRequest,
  type TopicDiscoveryRequest,
} from "@atlas/schema";

import { serverContextApiClient } from "./inProcessContextApi.js";

/**
 * Strict output validation is disabled because every response is already
 * parsed through the shared Zod schema in `serverContextApiClient`, which
 * guarantees runtime serializability. We keep input strictness so the
 * server function still rejects malformed loader payloads.
 */
const SERVER_FN_OPTIONS = { method: "GET", strict: { output: false } } as const;

export const fetchContextBundle = createServerFn(SERVER_FN_OPTIONS)
  .inputValidator((input: unknown): ContextRequest =>
    ContextRequestSchema.parse(input),
  )
  .handler(async ({ data }) => serverContextApiClient.getContextBundle(data));

export const fetchTopicDiscovery = createServerFn(SERVER_FN_OPTIONS)
  .inputValidator((input: unknown): TopicDiscoveryRequest =>
    TopicDiscoveryRequestSchema.parse(input ?? {}),
  )
  .handler(async ({ data }) => serverContextApiClient.discoverTopics(data));

export const fetchSourceDiscovery = createServerFn(SERVER_FN_OPTIONS)
  .inputValidator((input: unknown): SourceDiscoveryRequest =>
    SourceDiscoveryRequestSchema.parse(input ?? {}),
  )
  .handler(async ({ data }) => serverContextApiClient.discoverSources(data));
