import type {
  FeedbackResponse,
  FeedbackSubmission,
  ResourceCatalogResponse,
  ResourceContextResponse,
  ResourceRecordResponse,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
} from "@atlas/schema";

import type { ContextApiRequestOptions } from "./contextApiClient";
import { ContextApiError } from "./contextApiError";

type AtlasSchemas = typeof import("@atlas/schema");

export function fetchPortalResourceCatalog(options?: ContextApiRequestOptions) {
  return requestPortalJson<ResourceCatalogResponse>({
    url: "/api/resources/catalog",
    init: withSignal({ method: "GET" }, options),
    parse: (schemas, body) => schemas.ResourceCatalogResponseSchema.parse(body),
  });
}

export function fetchPortalSourceDiscovery(
  request: SourceDiscoveryRequest = {},
  options?: ContextApiRequestOptions,
) {
  return requestPortalJson<SourceDiscoveryResponse>({
    url: withQuery("/api/sources", request),
    init: withSignal({ method: "GET" }, options),
    parse: (schemas, body) => schemas.SourceDiscoveryResponseSchema.parse(body),
  });
}

export function fetchPortalResourceRecord(
  ref: { kind: string; slug: string },
  options?: ContextApiRequestOptions,
) {
  return requestPortalJson<ResourceRecordResponse>({
    url: `/api/resources/${encodeURIComponent(ref.kind)}/${encodeSlug(ref.slug)}/record`,
    init: withSignal({ method: "GET" }, options),
    parse: (schemas, body) => schemas.ResourceRecordResponseSchema.parse(body),
  });
}

export function fetchPortalResourceContext(
  ref: { kind: string; slug: string },
  options?: ContextApiRequestOptions,
) {
  return requestPortalJson<ResourceContextResponse>({
    url: `/api/resources/${encodeURIComponent(ref.kind)}/${encodeSlug(ref.slug)}`,
    init: withSignal({ method: "GET" }, options),
    parse: (schemas, body) => schemas.ResourceContextResponseSchema.parse(body),
  });
}

export function submitPortalFeedback(
  request: FeedbackSubmission,
  options?: ContextApiRequestOptions,
) {
  return requestPortalJson<FeedbackResponse>({
    url: "/api/feedback",
    init: withSignal(
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      },
      options,
    ),
    parse: (schemas, body) => schemas.FeedbackResponseSchema.parse(body),
  });
}

async function requestPortalJson<TBody>(input: {
  url: string;
  init: RequestInit;
  parse: (schemas: AtlasSchemas, body: unknown) => TBody;
}): Promise<TBody> {
  const responsePromise = fetch(input.url, input.init);
  const schemasPromise = import("@atlas/schema");
  const [response, schemas] = await Promise.all([responsePromise, schemasPromise]);
  const body: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const parsedError = schemas.ApiErrorResponseSchema.safeParse(body);
    if (parsedError.success) {
      throw ContextApiError.fromResponse({ status: response.status, body: parsedError.data });
    }
    throw new ContextApiError({
      code: "invalid_request",
      message: `Context API returned status ${response.status} with no structured error body.`,
      status: response.status,
    });
  }

  return input.parse(schemas, body);
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
