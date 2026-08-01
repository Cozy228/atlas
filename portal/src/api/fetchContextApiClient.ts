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

import type { ContextApiClient, ContextApiRequestOptions } from "./contextApiClient";
import { ContextApiError } from "./contextApiError";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type FetchContextApiClientInput = {
  baseUrl: string;
  fetch?: FetchLike;
  token?: string;
};

export function createFetchContextApiClient(input: FetchContextApiClientInput): ContextApiClient {
  const { baseUrl, fetch: fetchImpl } = requestContext(input);

  return {
    async getSource(id: string, options?: ContextApiRequestOptions) {
      return requestJson({
        fetch: fetchImpl,
        schema: SourceResponseSchema,
        url: `${baseUrl}/sources/${encodeURIComponent(id)}`,
        init: getRequest(options),
      });
    },
    async getAvailability(options?: ContextApiRequestOptions) {
      return requestJson({
        fetch: fetchImpl,
        schema: AvailabilityReadResponseSchema,
        url: `${baseUrl}/availability`,
        init: getRequest(options),
      });
    },
    async getResourceContext(kind: string, slug: string, options?: ContextApiRequestOptions) {
      return requestJson({
        fetch: fetchImpl,
        schema: ResourceContextResponseSchema,
        url: `${baseUrl}/resources/${encodeURIComponent(kind)}/${encodeSlug(slug)}`,
        init: getRequest(options),
      });
    },
    async getResourceRecord(kind: string, slug: string, options?: ContextApiRequestOptions) {
      return requestJson({
        fetch: fetchImpl,
        schema: ResourceRecordResponseSchema,
        url: `${baseUrl}/resources/${encodeURIComponent(kind)}/${encodeSlug(slug)}/record`,
        init: getRequest(options),
      });
    },
    async searchResources(query: string, options?: ContextApiRequestOptions) {
      return requestJson({
        fetch: fetchImpl,
        schema: ResourceSearchResponseSchema,
        url: withQuery(`${baseUrl}/resources`, { query }),
        init: getRequest(options),
      });
    },
    async discoverSources(
      request: SourceDiscoveryRequest = {},
      options?: ContextApiRequestOptions,
    ) {
      return requestJson({
        fetch: fetchImpl,
        schema: SourceDiscoveryResponseSchema,
        url: withQuery(`${baseUrl}/sources`, request),
        init: getRequest(options),
      });
    },
    async discoverResources(options?: ContextApiRequestOptions) {
      return requestJson({
        fetch: fetchImpl,
        schema: ResourceCatalogResponseSchema,
        url: `${baseUrl}/resources/catalog`,
        init: getRequest(options),
      });
    },
    async submitFeedback(request: FeedbackSubmission, options?: ContextApiRequestOptions) {
      return requestJson({
        fetch: fetchImpl,
        schema: FeedbackResponseSchema,
        url: `${baseUrl}/feedback`,
        init: withSignal(jsonPost(request), options),
      });
    },
  };
}

function requestContext(input: FetchContextApiClientInput): {
  baseUrl: string;
  fetch: FetchLike;
} {
  const rawFetch = input.fetch ?? fetch;
  const baseUrl = input.baseUrl.replace(/\/+$/, "");
  if (!input.token) {
    return { baseUrl, fetch: rawFetch };
  }
  return {
    baseUrl,
    fetch: (url, init) => {
      const headers = new Headers(init?.headers);
      if (!headers.has("authorization")) {
        headers.set("authorization", `Bearer ${input.token}`);
      }
      return rawFetch(url, { ...init, headers });
    },
  };
}

async function requestJson<TBody>(input: {
  fetch: FetchLike;
  schema: { parse(input: unknown): TBody };
  url: string;
  init: RequestInit;
}): Promise<TBody> {
  const response = await input.fetch(input.url, input.init);
  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
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

  return input.schema.parse(body);
}

function getRequest(options?: ContextApiRequestOptions): RequestInit {
  return withSignal({ method: "GET" }, options);
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function withSignal(init: RequestInit, options?: ContextApiRequestOptions): RequestInit {
  return options?.signal ? { ...init, signal: options.signal } : init;
}

function encodeSlug(slug: string): string {
  return slug
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
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
