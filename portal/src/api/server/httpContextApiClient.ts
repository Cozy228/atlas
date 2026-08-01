import {
  ApiErrorResponseSchema,
  AvailabilityReadResponseSchema,
  FeedbackResponseSchema,
  ResourceCatalogResponseSchema,
  ResourceContextResponseSchema,
  ResourceRecordResponseSchema,
  ResourceSearchResponseSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  type FeedbackSubmission,
  type SourceDiscoveryRequest,
} from "@atlas/schema";
import { logger, safeError } from "@atlas/logging";

import type { ContextApiClient } from "../contextApiClient";
import { ContextApiError } from "../contextApiError";
import { serverContextApiClient as inProcessContextApiClient } from "./inProcessContextApi";

const log = logger("portal.context-api");

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ServerContextApiClient = ContextApiClient & {
  kind: "http" | "in-process";
};

export function createServerContextApiClient(
  input: {
    env?: Record<string, string | undefined>;
    fetch?: FetchLike;
    token?: string;
  } = {},
): ServerContextApiClient {
  const baseUrl = input.env?.CONTEXT_API_BASE_URL ?? process.env.CONTEXT_API_BASE_URL;
  if (baseUrl) {
    log.debug(
      { event: "context_api.transport.configured", transport: "http" },
      "Context API transport configured",
    );
    return {
      ...createFetchContextApiClient({ baseUrl, fetch: input.fetch, token: input.token }),
      kind: "http",
    };
  }

  log.debug(
    { event: "context_api.transport.configured", transport: "in-process" },
    "Context API transport configured",
  );
  return {
    ...inProcessContextApiClient,
    kind: "in-process",
  };
}

export function createFetchContextApiClient(input: {
  baseUrl: string;
  fetch?: FetchLike;
  token?: string;
}): ContextApiClient {
  const rawFetch = input.fetch ?? fetch;
  const baseUrl = input.baseUrl.replace(/\/+$/, "");
  // The opaque caller Bearer, attached to every outbound call when present.
  // It is threaded unparsed and never serialized into any browser-facing body.
  const authHeaders: Record<string, string> = input.token
    ? { authorization: `Bearer ${input.token}` }
    : {};
  const fetchImpl: FetchLike = (url, init) =>
    rawFetch(url, {
      ...init,
      headers: { ...authHeaders, ...(init?.headers as Record<string, string> | undefined) },
    });

  return {
    async getSource(id: string) {
      return requestJson({
        operation: "get_source",
        fetch: fetchImpl,
        schema: SourceResponseSchema,
        url: `${baseUrl}/sources/${encodeURIComponent(id)}`,
      });
    },
    async getAvailability() {
      return requestJson({
        operation: "get_availability",
        fetch: fetchImpl,
        schema: AvailabilityReadResponseSchema,
        url: `${baseUrl}/availability`,
      });
    },
    async getResourceContext(kind: string, slug: string) {
      // slug may carry path separators (service slug = "{provider}/{id}"): encode
      // each segment but keep the separators as real path segments.
      const slugPath = slug
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
      return requestJson({
        operation: "get_resource_context",
        fetch: fetchImpl,
        schema: ResourceContextResponseSchema,
        url: `${baseUrl}/resources/${encodeURIComponent(kind)}/${slugPath}`,
      });
    },
    async getResourceRecord(kind: string, slug: string) {
      const slugPath = slug
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
      return requestJson({
        operation: "get_resource_record",
        fetch: fetchImpl,
        schema: ResourceRecordResponseSchema,
        url: `${baseUrl}/resources/${encodeURIComponent(kind)}/${slugPath}/record`,
      });
    },
    async searchResources(query: string) {
      return requestJson({
        operation: "search_resources",
        fetch: fetchImpl,
        schema: ResourceSearchResponseSchema,
        url: withQuery(`${baseUrl}/resources`, { query }),
      });
    },
    async discoverSources(request: SourceDiscoveryRequest = {}) {
      return requestJson({
        operation: "discover_sources",
        fetch: fetchImpl,
        schema: SourceDiscoveryResponseSchema,
        url: withQuery(`${baseUrl}/sources`, request),
      });
    },
    async discoverResources() {
      return requestJson({
        operation: "discover_resources",
        fetch: fetchImpl,
        schema: ResourceCatalogResponseSchema,
        url: `${baseUrl}/resources/catalog`,
      });
    },
    async submitFeedback(request: FeedbackSubmission) {
      return requestJson({
        operation: "submit_feedback",
        fetch: fetchImpl,
        schema: FeedbackResponseSchema,
        url: `${baseUrl}/feedback`,
        init: jsonPost(request),
      });
    },
  };
}

async function requestJson<TBody>(input: {
  operation: string;
  fetch: FetchLike;
  schema: { parse(input: unknown): TBody };
  url: string;
  init?: RequestInit;
}): Promise<TBody> {
  const startedAt = Date.now();
  let response: Response;
  try {
    response = await input.fetch(input.url, input.init ?? { method: "GET" });
  } catch (err) {
    log.error(
      {
        event: "context_api.request.failed",
        operation: input.operation,
        durationMs: Date.now() - startedAt,
        err: safeError(err, "Context API request failed"),
      },
      "Context API request failed",
    );
    throw err;
  }
  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    log.warn(
      {
        event: "context_api.request.completed",
        operation: input.operation,
        statusCode: response.status,
        outcome: "error",
        durationMs: Date.now() - startedAt,
      },
      "Context API request returned a non-success status",
    );
    const parsedError = ApiErrorResponseSchema.safeParse(body);
    if (parsedError.success) {
      throw ContextApiError.fromResponse({
        status: response.status,
        body: parsedError.data,
      });
    }
    throw new ContextApiError({
      code: "invalid_request",
      message: `Context API returned status ${response.status} with no structured error body.`,
      status: response.status,
    });
  }

  try {
    const parsed = input.schema.parse(body);
    log.info(
      {
        event: "context_api.request.completed",
        operation: input.operation,
        statusCode: response.status,
        outcome: "success",
        durationMs: Date.now() - startedAt,
      },
      "Context API request completed",
    );
    return parsed;
  } catch (err) {
    log.error(
      {
        event: "context_api.response.invalid",
        operation: input.operation,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
        err: safeError(err, "Context API response validation failed"),
      },
      "Context API response validation failed",
    );
    throw err;
  }
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function withQuery(url: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}
