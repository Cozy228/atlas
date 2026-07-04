import {
  AvailabilityReadResponseSchema,
  FeedbackResponseSchema,
  ResourceCatalogResponseSchema,
  ResourceContextResponseSchema,
  ResourceRecordResponseSchema,
  ResourceSearchResponseSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  type AppListResponse,
  type AppMutationResponse,
  type AppRegistrationRequest,
  type AppResponse,
  type AppUpdateRequest,
  type AvailabilityReadResponse,
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

/**
 * By-value / by-reference scope declaration threaded to the governed context
 * (Step 3 locked decision 7): `landingZones` inline (manifest value) and/or
 * `appId` (registered record). The in-process face passes it into
 * `createResolutionContext`; the HTTP face serializes it as the documented
 * `?landingZones=` / `?appId=` query params.
 */
export type AvailabilityScope = { landingZones?: string[]; appId?: string };

export type ContextApiClient = {
  getSource(id: string): Promise<SourceResponse>;
  /** Scoped availability (Step 3 D5/D8): with a scope, only the member zones
   *  return (unknown ids simply absent); without one, today's full grid. */
  getAvailability(scope?: AvailabilityScope): Promise<AvailabilityReadResponse>;
  /** Consumer state (Step 3, mid-level §3). Registration is an explicit act
   *  (M11) — these are the only writers; `origin` is always server-set. */
  listApps(): Promise<AppListResponse>;
  getApp(id: string): Promise<AppResponse>;
  registerApp(request: AppRegistrationRequest): Promise<AppMutationResponse>;
  updateApp(id: string, request: AppUpdateRequest): Promise<AppMutationResponse>;
  /** Live resource projection (plan 017): governed sections + reference-only
   *  discovery links for a canonical `{kind}/{slug}`. */
  getResourceContext(kind: string, slug: string): Promise<ResourceContextResponse>;
  /** Resource presentation metadata (ADR-0015 §2): the identity / owner / entry
   *  fields. Separate from getResourceContext, which stays content-only — the
   *  resource-first page composes this metadata read + that content read. */
  getResourceRecord(kind: string, slug: string): Promise<ResourceRecordResponse>;
  /** Resolve a free-text name to canonical resource ids (proposal §5.7). */
  searchResources(query: string): Promise<ResourceSearchResponse>;
  discoverSources(request?: SourceDiscoveryRequest): Promise<SourceDiscoveryResponse>;
  /** The discovery-derived catalog: every discovered Resource (services +
   *  guardrails) as a presentation record. The Portal catalog facets/tabs it. */
  discoverResources(): Promise<ResourceCatalogResponse>;
  submitFeedback(request: FeedbackSubmission): Promise<FeedbackResponse>;
};

type StaticContextApiClientInput = {
  sourceDiscovery: unknown;
  resourceCatalog: unknown;
  /** Optional availability grid; defaults to an empty, cited response. */
  availability?: unknown;
  /** Optional resource projections keyed by canonical `{kind}/{slug}`. */
  resourceContexts?: Record<string, unknown>;
  /** Optional resource metadata records keyed by canonical `{kind}/{slug}`;
   *  when absent, `getResourceRecord` derives identity-only from the projection. */
  resourceRecords?: Record<string, unknown>;
};

/** A valid-but-empty availability read for static clients that don't seed one. */
const EMPTY_AVAILABILITY: AvailabilityReadResponse = {
  zones: [],
  citation: {
    source_id: "availability-matrix",
    label: "Regional Availability Matrix",
    location: "https://confluence.example.com/display/CLOUD/Regional+Availability+Matrix",
  },
  warnings: [],
};

export function createStaticContextApiClient({
  sourceDiscovery,
  resourceCatalog,
  availability,
  resourceContexts,
  resourceRecords,
}: StaticContextApiClientInput): ContextApiClient {
  return {
    async getSource(id: string): Promise<SourceResponse> {
      const discovery = SourceDiscoveryResponseSchema.parse(sourceDiscovery);
      const source = discovery.sources.find((s) => s.id === id);
      if (!source) throw new Error(`Source not found: ${id}`);
      return SourceResponseSchema.parse({ source });
    },
    async getAvailability(_scope?: AvailabilityScope): Promise<AvailabilityReadResponse> {
      // Static face ignores scope for now; the frozen Step 3 suite covers the
      // in-process + HTTP faces only (Batch 3).
      return AvailabilityReadResponseSchema.parse(availability ?? EMPTY_AVAILABILITY);
    },
    // Consumer state (self-declared APPs) is durable server-side state; the
    // static browser client is a read-only snapshot, so it has no APPs to list
    // and cannot persist a registration. The Portal's self-declare form drives
    // the server-side client (in-process / HTTP), never this one.
    async listApps(): Promise<AppListResponse> {
      return { apps: [] };
    },
    async getApp(id: string): Promise<AppResponse> {
      throw new Error(`Static context client has no app '${id}'.`);
    },
    async registerApp(_request: AppRegistrationRequest): Promise<AppMutationResponse> {
      throw new Error("Static context client cannot register an app (server-side consumer state).");
    },
    async updateApp(id: string, _request: AppUpdateRequest): Promise<AppMutationResponse> {
      throw new Error(`Static context client cannot update app '${id}'.`);
    },
    async getResourceContext(kind: string, slug: string): Promise<ResourceContextResponse> {
      const projection = resourceContexts?.[`${kind}/${slug}`];
      if (!projection) throw new Error(`Resource not found: ${kind}/${slug}`);
      return ResourceContextResponseSchema.parse(projection);
    },
    async getResourceRecord(kind: string, slug: string): Promise<ResourceRecordResponse> {
      const explicit = resourceRecords?.[`${kind}/${slug}`];
      if (explicit) return ResourceRecordResponseSchema.parse(explicit);
      // Derive identity-only from the projection when no metadata record is seeded.
      const projection = resourceContexts?.[`${kind}/${slug}`];
      if (!projection) throw new Error(`Resource not found: ${kind}/${slug}`);
      const ctx = ResourceContextResponseSchema.parse(projection);
      return ResourceRecordResponseSchema.parse({
        kind: ctx.resource.kind,
        id: ctx.resource.id,
        slug: ctx.resource.slug,
        ...(ctx.resource.provider ? { provider: ctx.resource.provider } : {}),
        name: ctx.resource.name,
        aliases: ctx.resource.aliases,
      });
    },
    async searchResources(query: string): Promise<ResourceSearchResponse> {
      const tokens = query
        .toLowerCase()
        .split(/[^a-z0-9-]+/)
        .filter((token) => token.length >= 2);
      const items = Object.values(resourceContexts ?? {})
        .map((raw) => ResourceContextResponseSchema.parse(raw).resource)
        .filter((resource) => {
          const haystack = [resource.name, ...resource.aliases, resource.slug]
            .join(" ")
            .toLowerCase();
          return tokens.some((token) => haystack.includes(token));
        })
        .map((resource) => ({ ...resource, matchReason: "Matched on name or alias" }));
      return ResourceSearchResponseSchema.parse({ items });
    },
    async discoverSources(): Promise<SourceDiscoveryResponse> {
      return SourceDiscoveryResponseSchema.parse(sourceDiscovery);
    },
    async discoverResources(): Promise<ResourceCatalogResponse> {
      return ResourceCatalogResponseSchema.parse(resourceCatalog);
    },
    async submitFeedback(request: FeedbackSubmission): Promise<FeedbackResponse> {
      return FeedbackResponseSchema.parse({
        feedback: {
          id: `feedback-static-${request.target_type}-${request.target_id}`,
          submitted_at: new Date().toISOString(),
          ...request,
        },
      });
    },
  };
}
