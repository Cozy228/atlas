import {
  AvailabilityReadResponseSchema,
  FeedbackResponseSchema,
  ResourceContextResponseSchema,
  ResourceRecordResponseSchema,
  ResourceSearchResponseSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  TopicDiscoveryResponseSchema,
  TopicResponseSchema,
  type AvailabilityReadResponse,
  type FeedbackResponse,
  type FeedbackSubmission,
  type ResourceContextResponse,
  type ResourceRecordResponse,
  type ResourceSearchResponse,
  type SourceDiscoveryRequest,
  type SourceDiscoveryResponse,
  type SourceResponse,
  type TopicDiscoveryRequest,
  type TopicDiscoveryResponse,
  type TopicResponse,
} from "@atlas/schema";

export type ContextApiClient = {
  getTopic(id: string): Promise<TopicResponse>;
  getSource(id: string): Promise<SourceResponse>;
  getAvailability(): Promise<AvailabilityReadResponse>;
  /** Live resource projection (plan 017): governed sections + reference-only
   *  discovery links + governance state for a canonical `{kind}/{slug}`. */
  getResourceContext(kind: string, slug: string): Promise<ResourceContextResponse>;
  /** Resource presentation metadata (plan 020 15d, ADR-0015 §2): the identity /
   *  owner / entry fields migrated off the Topic. Separate from
   *  getResourceContext, which stays content-only — the resource-first page
   *  composes this metadata read + that content read. */
  getResourceRecord(kind: string, slug: string): Promise<ResourceRecordResponse>;
  /** Resolve a free-text name to canonical resource ids (proposal §5.7). */
  searchResources(query: string): Promise<ResourceSearchResponse>;
  discoverSources(request?: SourceDiscoveryRequest): Promise<SourceDiscoveryResponse>;
  discoverTopics(request?: TopicDiscoveryRequest): Promise<TopicDiscoveryResponse>;
  submitFeedback(request: FeedbackSubmission): Promise<FeedbackResponse>;
};

type StaticContextApiClientInput = {
  sourceDiscovery: unknown;
  topicDiscovery: unknown;
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
  topicDiscovery,
  availability,
  resourceContexts,
  resourceRecords,
}: StaticContextApiClientInput): ContextApiClient {
  return {
    async getTopic(id: string): Promise<TopicResponse> {
      const discovery = TopicDiscoveryResponseSchema.parse(topicDiscovery);
      const topic = discovery.topics.find((t) => t.id === id);
      if (!topic) throw new Error(`Topic not found: ${id}`);
      return TopicResponseSchema.parse({ topic });
    },
    async getSource(id: string): Promise<SourceResponse> {
      const discovery = SourceDiscoveryResponseSchema.parse(sourceDiscovery);
      const source = discovery.sources.find((s) => s.id === id);
      if (!source) throw new Error(`Source not found: ${id}`);
      return SourceResponseSchema.parse({ source });
    },
    async getAvailability(): Promise<AvailabilityReadResponse> {
      return AvailabilityReadResponseSchema.parse(availability ?? EMPTY_AVAILABILITY);
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
        governance: ctx.governance,
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
    async discoverTopics(): Promise<TopicDiscoveryResponse> {
      return TopicDiscoveryResponseSchema.parse(topicDiscovery);
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
