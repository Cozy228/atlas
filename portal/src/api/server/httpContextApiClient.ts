import {
  ApiErrorResponseSchema,
  AvailabilityReadResponseSchema,
  FeedbackResponseSchema,
  ResourceContextResponseSchema,
  ResourceRecordResponseSchema,
  ResourceSearchResponseSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  TopicDiscoveryResponseSchema,
  TopicResponseSchema,
  type FeedbackSubmission,
  type SourceDiscoveryRequest,
  type TopicDiscoveryRequest,
} from "@atlas/schema";

import type { ContextApiClient } from "../contextApiClient";
import { ContextApiError } from "../contextApiError";
import { serverContextApiClient as inProcessContextApiClient } from "./inProcessContextApi";

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
  const baseUrl = input.env?.ATLAS_CONTEXT_API_BASE_URL ?? process.env.ATLAS_CONTEXT_API_BASE_URL;
  if (baseUrl) {
    return {
      ...createFetchContextApiClient({ baseUrl, fetch: input.fetch, token: input.token }),
      kind: "http",
    };
  }

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
    async getTopic(id: string) {
      return requestJson({
        fetch: fetchImpl,
        schema: TopicResponseSchema,
        url: `${baseUrl}/topics/${encodeURIComponent(id)}`,
      });
    },
    async getSource(id: string) {
      return requestJson({
        fetch: fetchImpl,
        schema: SourceResponseSchema,
        url: `${baseUrl}/sources/${encodeURIComponent(id)}`,
      });
    },
    async getAvailability() {
      return requestJson({
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
        fetch: fetchImpl,
        schema: ResourceRecordResponseSchema,
        url: `${baseUrl}/resources/${encodeURIComponent(kind)}/${slugPath}/record`,
      });
    },
    async searchResources(query: string) {
      return requestJson({
        fetch: fetchImpl,
        schema: ResourceSearchResponseSchema,
        url: withQuery(`${baseUrl}/resources`, { query }),
      });
    },
    async discoverSources(request: SourceDiscoveryRequest = {}) {
      return requestJson({
        fetch: fetchImpl,
        schema: SourceDiscoveryResponseSchema,
        url: withQuery(`${baseUrl}/sources`, request),
      });
    },
    async discoverTopics(request: TopicDiscoveryRequest = {}) {
      return requestJson({
        fetch: fetchImpl,
        schema: TopicDiscoveryResponseSchema,
        url: withQuery(`${baseUrl}/topics`, request),
      });
    },
    async submitFeedback(request: FeedbackSubmission) {
      return requestJson({
        fetch: fetchImpl,
        schema: FeedbackResponseSchema,
        url: `${baseUrl}/feedback`,
        init: jsonPost(request),
      });
    },
  };
}

async function requestJson<TBody>(input: {
  fetch: FetchLike;
  schema: { parse(input: unknown): TBody };
  url: string;
  init?: RequestInit;
}): Promise<TBody> {
  const response = await input.fetch(input.url, input.init ?? { method: "GET" });
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
