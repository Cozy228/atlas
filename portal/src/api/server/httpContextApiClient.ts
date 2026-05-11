import {
  ApiErrorResponseSchema,
  ContextBundleResponseSchema,
  FeedbackResponseSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  TopicDiscoveryResponseSchema,
  TopicResponseSchema,
  type ContextRequest,
  type FeedbackSubmission,
  type SourceDiscoveryRequest,
  type TopicDiscoveryRequest,
} from "@atlas/schema";

import type { ContextApiClient } from "../contextApiClient.js";
import { ContextApiError } from "../contextApiError.js";
import { serverContextApiClient as inProcessContextApiClient } from "./inProcessContextApi.js";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ServerContextApiClient = ContextApiClient & {
  kind: "http" | "in-process";
};

export function createServerContextApiClient(input: {
  env?: Record<string, string | undefined>;
  fetch?: FetchLike;
} = {}): ServerContextApiClient {
  const baseUrl = input.env?.ATLAS_CONTEXT_API_BASE_URL ?? process.env.ATLAS_CONTEXT_API_BASE_URL;
  if (baseUrl) {
    return {
      ...createFetchContextApiClient({ baseUrl, fetch: input.fetch }),
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
}): ContextApiClient {
  const fetchImpl = input.fetch ?? fetch;
  const baseUrl = input.baseUrl.replace(/\/+$/, "");

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
    async getContextBundle(request: ContextRequest) {
      if (request.topic_id) {
        return requestJson({
          fetch: fetchImpl,
          schema: ContextBundleResponseSchema,
          url: withQuery(`${baseUrl}/topics/${encodeURIComponent(request.topic_id)}/context`, {
            anchor_id: request.anchor_id,
            disclosure_level: request.disclosure_level?.toString(),
          }),
        });
      }

      if (request.source_id) {
        return requestJson({
          fetch: fetchImpl,
          schema: ContextBundleResponseSchema,
          url: withQuery(`${baseUrl}/sources/${encodeURIComponent(request.source_id)}/content`, {
            anchor_id: request.anchor_id,
            disclosure_level: request.disclosure_level?.toString(),
          }),
        });
      }

      return requestJson({
        fetch: fetchImpl,
        schema: ContextBundleResponseSchema,
        url: `${baseUrl}/context-bundle`,
        init: jsonPost(request),
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
