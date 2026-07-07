/**
 * Server-only Context API client.
 *
 * This module imports the in-process Context Layer handlers and is therefore
 * never bundled into the browser. Once the Context Layer ships an HTTP
 * surface, swap the implementation here for a fetch-based client and keep
 * the same `ContextApiClient` interface so route loaders do not change.
 */
import {
  createResolutionContext,
  handleAppRegistrationRequest,
  handleAppRequest,
  handleAppsListRequest,
  handleAppUpdateRequest,
  handleAvailabilityRequest,
  handleBriefRequest,
  handleChangesRequest,
  handleFeedbackRequest,
  handleLocationDeleteRequest,
  handleLocationRegistrationRequest,
  handleLocationsListRequest,
  handleStatusRequest,
  handleResourceCatalogRequest,
  handleResourceContextRequest,
  handleResourceRecordRequest,
  handleResourceSearchRequest,
  handleSourceDiscoveryRequest,
  handleSourceRequest,
  instrumentsMetrics,
  API_DEFAULT_DEPTH,
  type ResolutionChannel,
  type ScopeInput,
} from "@atlas/context-layer";
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
  type LocationListResponse,
  type LocationRegistrationRequest,
  type LocationRegistrationResponse,
  type StatusBoardResponse,
  type AvailabilityReadResponse,
  type Brief,
  type BriefDepth,
  type ChangesResponse,
  type FeedbackResponse,
  type FeedbackSubmission,
  type ResourceCatalogResponse,
  type ResourceContextResponse,
  type ResourceRecordResponse,
  type ResourceSearchResponse,
  type SourceDiscoveryRequest,
  type SourceDiscoveryResponse,
  type SourceResponse,
} from "@atlas/schema";

import type { AvailabilityScope, BriefRequestScope, ContextApiClient } from "../contextApiClient";

/** Map the client-facing availability scope to Step 1's `ScopeInput` union. */
function toScopeInput(scope: AvailabilityScope | undefined): ScopeInput | undefined {
  const landingZones = scope?.landingZones?.filter((zone) => zone.length > 0) ?? [];
  const appId = scope?.appId?.trim() || undefined;
  const hasValue = landingZones.length > 0;
  if (hasValue && appId) {
    return { kind: "both", landingZones, appId };
  }
  if (hasValue) {
    return { kind: "by-value", landingZones };
  }
  if (appId) {
    return { kind: "by-reference", appId };
  }
  return undefined;
}
import { ContextApiError } from "../contextApiError";

type HandlerResult = { status: number; body: unknown };

function unwrap<TBody>(result: HandlerResult, schema: { parse(input: unknown): TBody }): TBody {
  if (result.status >= 400) {
    const parsedError = ApiErrorResponseSchema.safeParse(result.body);
    if (parsedError.success) {
      throw ContextApiError.fromResponse({
        status: result.status,
        body: parsedError.data,
      });
    }
    throw new ContextApiError({
      code: "invalid_request",
      message: `Context API returned status ${result.status} with no structured error body.`,
      status: result.status,
    });
  }
  return schema.parse(result.body);
}

/**
 * Build an in-process Context API client that constructs its resolution context
 * through the one governance-gate factory (Step 1). This closes the previously
 * ungoverned in-process path: the resource read wires the process-shared content
 * cache and threads the caller Bearer (when the caller has one — the MCP
 * in-process fallback supplies it; the Portal is honest-anonymous today).
 */
export function createInProcessContextApiClient(
  options: { token?: string; channel?: ResolutionChannel } = {},
): ContextApiClient {
  // The in-process client is the Portal loader face by default (Step 6, locked
  // decision 2); the MCP in-process fallback threads `"mcp"` through instead.
  const channel: ResolutionChannel = options.channel ?? "portal";
  return {
    async getSource(id: string): Promise<SourceResponse> {
      return unwrap(await handleSourceRequest(id), SourceResponseSchema);
    },
    async getAvailability(scope?: AvailabilityScope): Promise<AvailabilityReadResponse> {
      // The governed availability read (Step 3 decision 7): thread the caller
      // scope through the one governance-gate factory into the ctx-taking handler.
      const ctx = await createResolutionContext({
        identity: { bearer: options.token },
        scope: toScopeInput(scope),
        channel,
      });
      return unwrap(await handleAvailabilityRequest(ctx), AvailabilityReadResponseSchema);
    },
    async getChanges(scope?: AvailabilityScope, since?: string): Promise<ChangesResponse> {
      // The governed change feed (Step 2 decision 6): thread the caller scope
      // through the one governance-gate factory into the ctx-taking handler.
      const ctx = await createResolutionContext({
        identity: { bearer: options.token },
        scope: toScopeInput(scope),
        channel,
      });
      return unwrap(await handleChangesRequest(ctx, { since }), ChangesResponseSchema);
    },
    async getBrief(moment: string, scope?: BriefRequestScope, depth?: BriefDepth): Promise<Brief> {
      // The governed brief read (Step 4, I3): thread the caller scope + Bearer
      // through the one governance-gate factory into the ctx-taking handler; the
      // adopt/build target `service` rides the scope into the handler options
      // (mid-level §3 `?service=`). The one Brief value is validated against the
      // shared schema like every face.
      const ctx = await createResolutionContext({
        identity: { bearer: options.token },
        scope: toScopeInput(scope),
        channel,
      });
      const brief = unwrap(
        await handleBriefRequest(moment, ctx, { service: scope?.service, depth }),
        BriefSchema,
      );
      // P28 token economy (Step 6, locked decision 5): the Portal loader serializes
      // the Brief as the JSON RPC body sent to the browser, so it records the
      // `face:"json"` payload cost on its own channel (default `"portal"`).
      instrumentsMetrics.recordBriefPayload({
        moment: brief.moment,
        depth: depth ?? API_DEFAULT_DEPTH,
        channel,
        face: "json",
        serialize: () => JSON.stringify(brief),
      });
      return brief;
    },
    async listApps(): Promise<AppListResponse> {
      return unwrap(await handleAppsListRequest(), AppListResponseSchema);
    },
    async getApp(id: string): Promise<AppResponse> {
      return unwrap(await handleAppRequest(id), AppResponseSchema);
    },
    async registerApp(request: AppRegistrationRequest): Promise<AppMutationResponse> {
      return unwrap(await handleAppRegistrationRequest(request), AppMutationResponseSchema);
    },
    async updateApp(id: string, request: AppUpdateRequest): Promise<AppMutationResponse> {
      return unwrap(await handleAppUpdateRequest(id, request), AppMutationResponseSchema);
    },
    async getStatus(scope?: AvailabilityScope): Promise<StatusBoardResponse> {
      // The governed status board (Step 7, P24): thread the caller scope + Bearer
      // through the one governance-gate factory into the ctx-taking handler.
      const ctx = await createResolutionContext({
        identity: { bearer: options.token },
        scope: toScopeInput(scope),
      });
      return unwrap(await handleStatusRequest(ctx), StatusBoardResponseSchema);
    },
    async listLocations(scope?: AvailabilityScope): Promise<LocationListResponse> {
      const ctx = await createResolutionContext({
        identity: { bearer: options.token },
        scope: toScopeInput(scope),
      });
      return unwrap(await handleLocationsListRequest(ctx), LocationListResponseSchema);
    },
    async registerLocation(
      request: LocationRegistrationRequest,
      scope?: AvailabilityScope,
    ): Promise<LocationRegistrationResponse> {
      // The scoped APP the location belongs to arrives via the request scope
      // (`?appId=`), threaded into the governed ctx — never the request body.
      const ctx = await createResolutionContext({
        identity: { bearer: options.token },
        scope: toScopeInput(scope),
      });
      return unwrap(
        await handleLocationRegistrationRequest(ctx, request),
        LocationRegistrationResponseSchema,
      );
    },
    async deleteLocation(id: string): Promise<LocationRegistrationResponse> {
      const ctx = await createResolutionContext({ identity: { bearer: options.token } });
      return unwrap(await handleLocationDeleteRequest(ctx, id), LocationRegistrationResponseSchema);
    },
    async getResourceContext(kind: string, slug: string): Promise<ResourceContextResponse> {
      const ctx = await createResolutionContext({ identity: { bearer: options.token }, channel });
      return unwrap(
        await handleResourceContextRequest({ kind, slug }, ctx),
        ResourceContextResponseSchema,
      );
    },
    async getResourceRecord(kind: string, slug: string): Promise<ResourceRecordResponse> {
      return unwrap(
        await handleResourceRecordRequest({ kind, slug }),
        ResourceRecordResponseSchema,
      );
    },
    async searchResources(query: string): Promise<ResourceSearchResponse> {
      return unwrap(await handleResourceSearchRequest(query, {}), ResourceSearchResponseSchema);
    },
    async discoverSources(request: SourceDiscoveryRequest = {}): Promise<SourceDiscoveryResponse> {
      return unwrap(await handleSourceDiscoveryRequest(request), SourceDiscoveryResponseSchema);
    },
    async discoverResources(): Promise<ResourceCatalogResponse> {
      return unwrap(await handleResourceCatalogRequest(), ResourceCatalogResponseSchema);
    },
    async submitFeedback(request: FeedbackSubmission): Promise<FeedbackResponse> {
      return unwrap(await handleFeedbackRequest(request), FeedbackResponseSchema);
    },
  };
}

export const serverContextApiClient: ContextApiClient = createInProcessContextApiClient();
