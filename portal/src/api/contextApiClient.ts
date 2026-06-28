import {
  AvailabilityReadResponseSchema,
  ContextBundleResponseSchema,
  FeedbackResponseSchema,
  ResourceContextResponseSchema,
  SourceDiscoveryResponseSchema,
  SourceResponseSchema,
  TopicDiscoveryResponseSchema,
  TopicResponseSchema,
  type AvailabilityReadResponse,
  type ContextBundleResponse,
  type ContextRequest,
  type FeedbackResponse,
  type FeedbackSubmission,
  type ResourceContextResponse,
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
  getContextBundle(request: ContextRequest): Promise<ContextBundleResponse>;
  getAvailability(): Promise<AvailabilityReadResponse>;
  /** Live resource projection (plan 017): governed sections + reference-only
   *  discovery links + governance state for a canonical `{kind}/{slug}`. */
  getResourceContext(kind: string, slug: string): Promise<ResourceContextResponse>;
  discoverSources(request?: SourceDiscoveryRequest): Promise<SourceDiscoveryResponse>;
  discoverTopics(request?: TopicDiscoveryRequest): Promise<TopicDiscoveryResponse>;
  submitFeedback(request: FeedbackSubmission): Promise<FeedbackResponse>;
};

type StaticContextApiClientInput = {
  contextBundles: Record<string, unknown>;
  sourceDiscovery: unknown;
  topicDiscovery: unknown;
  /** Optional availability grid; defaults to an empty, cited response. */
  availability?: unknown;
  /** Optional resource projections keyed by canonical `{kind}/{slug}`. */
  resourceContexts?: Record<string, unknown>;
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
  contextBundles,
  sourceDiscovery,
  topicDiscovery,
  availability,
  resourceContexts,
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
    async getContextBundle(request: ContextRequest): Promise<ContextBundleResponse> {
      const key = request.topic_id ?? request.source_id ?? "default";
      return ContextBundleResponseSchema.parse(contextBundles[key]);
    },
    async getAvailability(): Promise<AvailabilityReadResponse> {
      return AvailabilityReadResponseSchema.parse(availability ?? EMPTY_AVAILABILITY);
    },
    async getResourceContext(kind: string, slug: string): Promise<ResourceContextResponse> {
      const projection = resourceContexts?.[`${kind}/${slug}`];
      if (!projection) throw new Error(`Resource not found: ${kind}/${slug}`);
      return ResourceContextResponseSchema.parse(projection);
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
