import {
  ContextBundleResponseSchema,
  SourceDiscoveryResponseSchema,
  TopicDiscoveryResponseSchema,
  type ContextBundleResponse,
  type ContextRequest,
  type SourceDiscoveryResponse,
  type TopicDiscoveryResponse,
} from "@atlas/schema";

export type ContextApiClient = {
  getContextBundle(request: ContextRequest): Promise<ContextBundleResponse>;
  discoverSources(): Promise<SourceDiscoveryResponse>;
  discoverTopics(): Promise<TopicDiscoveryResponse>;
};

type StaticContextApiClientInput = {
  contextBundles: Record<string, unknown>;
  sourceDiscovery: unknown;
  topicDiscovery: unknown;
};

export function createStaticContextApiClient({
  contextBundles,
  sourceDiscovery,
  topicDiscovery,
}: StaticContextApiClientInput): ContextApiClient {
  return {
    async getContextBundle(request: ContextRequest): Promise<ContextBundleResponse> {
      const key = request.topic_id ?? request.source_id ?? "default";
      return ContextBundleResponseSchema.parse(contextBundles[key]);
    },
    async discoverSources(): Promise<SourceDiscoveryResponse> {
      return SourceDiscoveryResponseSchema.parse(sourceDiscovery);
    },
    async discoverTopics(): Promise<TopicDiscoveryResponse> {
      return TopicDiscoveryResponseSchema.parse(topicDiscovery);
    },
  };
}
