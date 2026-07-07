import {
  ApiErrorResponseSchema,
  AppListResponseSchema,
  AppMutationResponseSchema,
  AppResponseSchema,
  AvailabilityReadResponseSchema,
  BriefSchema,
  ChangesResponseSchema,
  FeedbackResponseSchema,
  LocationListResponseSchema,
  LocationRegistrationResponseSchema,
  ResourceCatalogResponseSchema,
  ResourceContextResponseSchema,
  ResourceRecordResponseSchema,
  ResourceSearchResponseSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  StatusBoardResponseSchema,
  type AppListResponse,
  type AppMutationResponse,
  type AppRegistrationRequest,
  type AppResponse,
  type AppUpdateRequest,
  type Brief,
  type BriefDepth,
  type FeedbackSubmission,
  type LocationListResponse,
  type LocationRegistrationRequest,
  type LocationRegistrationResponse,
  type SourceDiscoveryRequest,
  type StatusBoardResponse,
} from "@atlas/schema";

import type { ResolutionChannel } from "@atlas/context-layer";
import type { AvailabilityScope, BriefRequestScope, ContextApiClient } from "../contextApiClient";
import { ContextApiError } from "../contextApiError";
import { createInProcessContextApiClient } from "./inProcessContextApi";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type ServerContextApiClient = ContextApiClient & {
  kind: "http" | "in-process";
};

export function createServerContextApiClient(
  input: {
    env?: Record<string, string | undefined>;
    fetch?: FetchLike;
    token?: string;
    /** The producing face for instruments attribution (Step 6, locked decision
     *  2). Only meaningful on the in-process fallback: an HTTP base URL means the
     *  request re-enters the router, which stamps its own `"http"` channel. */
    channel?: ResolutionChannel;
  } = {},
): ServerContextApiClient {
  const baseUrl = input.env?.CONTEXT_API_BASE_URL ?? process.env.CONTEXT_API_BASE_URL;
  if (baseUrl) {
    return {
      ...createFetchContextApiClient({ baseUrl, fetch: input.fetch, token: input.token }),
      kind: "http",
    };
  }

  return {
    // The in-process fallback threads the caller Bearer into the governance-gate
    // factory (Step 1 D4) instead of silently dropping it, plus the producing
    // face (Step 6) so MCP-in-process reads attribute to the agent channel.
    ...createInProcessContextApiClient({ token: input.token, channel: input.channel }),
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
        fetch: fetchImpl,
        schema: SourceResponseSchema,
        url: `${baseUrl}/sources/${encodeURIComponent(id)}`,
      });
    },
    async getAvailability(scope?: AvailabilityScope) {
      // Step 3 Batch 3: serialize the scope as the documented `?landingZones=`
      // (comma-joined) / `?appId=` query the governed router already parses.
      // Batch 0 keeps the bare unscoped URL so the tree stays green.
      const query: Record<string, string | undefined> = scope
        ? {
            landingZones: scope.landingZones?.length ? scope.landingZones.join(",") : undefined,
            appId: scope.appId,
          }
        : {};
      return requestJson({
        fetch: fetchImpl,
        schema: AvailabilityReadResponseSchema,
        url: withQuery(`${baseUrl}/availability`, query),
      });
    },
    async getChanges(scope?: AvailabilityScope, since?: string) {
      // Same scope serialization as availability (`?landingZones=`/`?appId=`),
      // plus the opaque `?since=` cursor the governed router already parses.
      const query: Record<string, string | undefined> = {
        landingZones: scope?.landingZones?.length ? scope.landingZones.join(",") : undefined,
        appId: scope?.appId,
        since,
      };
      return requestJson({
        fetch: fetchImpl,
        schema: ChangesResponseSchema,
        url: withQuery(`${baseUrl}/changes`, query),
      });
    },
    async getBrief(moment: string, scope?: BriefRequestScope, depth?: BriefDepth): Promise<Brief> {
      // Same scope serialization as availability/changes (`?landingZones=`/
      // `?appId=`), plus the adopt/build target `?service=` (mid-level §3) and the
      // `?depth=` tier (M9). The moment is a path segment, mirroring
      // `/resources/{kind}/{slug}`.
      const query: Record<string, string | undefined> = {
        landingZones: scope?.landingZones?.length ? scope.landingZones.join(",") : undefined,
        appId: scope?.appId,
        service: scope?.service,
        depth,
      };
      return requestJson({
        fetch: fetchImpl,
        schema: BriefSchema,
        url: withQuery(`${baseUrl}/briefs/${encodeURIComponent(moment)}`, query),
      });
    },
    async listApps(): Promise<AppListResponse> {
      return requestJson({
        fetch: fetchImpl,
        schema: AppListResponseSchema,
        url: `${baseUrl}/apps`,
      });
    },
    async getApp(id: string): Promise<AppResponse> {
      return requestJson({
        fetch: fetchImpl,
        schema: AppResponseSchema,
        url: `${baseUrl}/apps/${encodeURIComponent(id)}`,
      });
    },
    async registerApp(request: AppRegistrationRequest): Promise<AppMutationResponse> {
      return requestJson({
        fetch: fetchImpl,
        schema: AppMutationResponseSchema,
        url: `${baseUrl}/apps`,
        init: jsonPost(request),
      });
    },
    async updateApp(id: string, request: AppUpdateRequest): Promise<AppMutationResponse> {
      return requestJson({
        fetch: fetchImpl,
        schema: AppMutationResponseSchema,
        url: `${baseUrl}/apps/${encodeURIComponent(id)}`,
        init: jsonPatch(request),
      });
    },
    async getStatus(scope?: AvailabilityScope): Promise<StatusBoardResponse> {
      const query: Record<string, string | undefined> = {
        landingZones: scope?.landingZones?.length ? scope.landingZones.join(",") : undefined,
        appId: scope?.appId,
      };
      return requestJson({
        fetch: fetchImpl,
        schema: StatusBoardResponseSchema,
        url: withQuery(`${baseUrl}/status`, query),
      });
    },
    async listLocations(scope?: AvailabilityScope): Promise<LocationListResponse> {
      const query: Record<string, string | undefined> = {
        landingZones: scope?.landingZones?.length ? scope.landingZones.join(",") : undefined,
        appId: scope?.appId,
      };
      return requestJson({
        fetch: fetchImpl,
        schema: LocationListResponseSchema,
        url: withQuery(`${baseUrl}/locations`, query),
      });
    },
    async registerLocation(
      request: LocationRegistrationRequest,
      scope?: AvailabilityScope,
    ): Promise<LocationRegistrationResponse> {
      const query: Record<string, string | undefined> = {
        landingZones: scope?.landingZones?.length ? scope.landingZones.join(",") : undefined,
        appId: scope?.appId,
      };
      return requestJson({
        fetch: fetchImpl,
        schema: LocationRegistrationResponseSchema,
        url: withQuery(`${baseUrl}/locations`, query),
        init: jsonPost(request),
      });
    },
    async deleteLocation(id: string): Promise<LocationRegistrationResponse> {
      return requestJson({
        fetch: fetchImpl,
        schema: LocationRegistrationResponseSchema,
        url: `${baseUrl}/locations/${encodeURIComponent(id)}`,
        init: { method: "DELETE" },
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
    async discoverResources() {
      return requestJson({
        fetch: fetchImpl,
        schema: ResourceCatalogResponseSchema,
        url: `${baseUrl}/resources/catalog`,
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

function jsonPatch(body: unknown): RequestInit {
  return {
    method: "PATCH",
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
