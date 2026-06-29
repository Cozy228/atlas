import type {
  Source,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
  Topic,
  TopicDiscoveryRequest,
  TopicDiscoveryResponse,
  ResourceContextRecord,
} from "@atlas/schema";
import type { FeedbackRepository } from "../repositories/feedbackRepository";
import type { Registry } from "../registry/registry";
import type { ResolverRegistry } from "../resolvers/resolverRegistry";
import type { SourceContentProvider } from "../resolvers/sourceContentProvider";
import type { AvailabilityProvider } from "./availabilityProvider";
import type { ResourceReferenceDiscovery } from "./resourceReferenceDiscovery";

/**
 * The assembled Context Layer service container — the registry plus the live
 * resolution ports the routes share. (Renamed from `ContextBundleService` once
 * the `ContextBundle` response it once built was retired, plan 019; the
 * container and its discovery queries outlive that contract.)
 */
export type ContextService = {
  registry: Registry;
  resolvers: ResolverRegistry;
  contentProvider: SourceContentProvider;
  availabilityProvider: AvailabilityProvider;
  /** Reference-only Confluence discovery port (plan 017). Optional: when unset,
   *  resource reads carry an empty `references` list + `null` discovery state. */
  referenceDiscovery?: ResourceReferenceDiscovery;
  /** Kind-first resource projection records (agent-facing resource surface). */
  resources: ResourceContextRecord[];
  now: Date;
};

export type ContextServiceOptions = {
  env?: Record<string, string | undefined>;
  feedbackRepository?: FeedbackRepository;
  /** Injection seam: supply an assembled registry port (tests / adapters). */
  registry?: Registry;
  /** Injection seam: supply a source-content provider port (tests / adapters). */
  contentProvider?: SourceContentProvider;
  /** Injection seam: supply an availability provider port (tests / adapters). */
  availabilityProvider?: AvailabilityProvider;
  /** Injection seam: supply a reference-discovery port (tests / live adapter). */
  referenceDiscovery?: ResourceReferenceDiscovery;
  /** Injection seam: override the manifest-loaded resource records (tests). */
  resources?: ResourceContextRecord[];
};

export function discoverSources(
  service: ContextService,
  request: SourceDiscoveryRequest,
): SourceDiscoveryResponse {
  const sources = service.registry.sources.list().filter((source) => {
    if (request.source_class && source.source_class !== request.source_class) {
      return false;
    }
    if (request.topic_id) {
      return service.registry.mappings
        .findByTopicId(request.topic_id)
        .some((mapping) => mapping.source_id === source.id);
    }
    if (request.query) {
      return matchesText(source, request.query);
    }
    return true;
  });

  return { sources };
}

export function discoverTopics(
  service: ContextService,
  request: TopicDiscoveryRequest,
): TopicDiscoveryResponse {
  const topics = service.registry.topics.list().filter((topic) => {
    if (request.topic_type && topic.topic_type !== request.topic_type) {
      return false;
    }
    if (request.category && topic.category !== request.category) {
      return false;
    }
    if (request.query) {
      return matchesTopic(topic, request.query);
    }
    return true;
  });

  return { topics };
}

function matchesTopic(topic: Topic, query: string): boolean {
  const haystack = [
    topic.id,
    topic.name,
    topic.topic_type,
    topic.category,
    topic.description,
    topic.owner_team,
  ].join(" ");
  return normalizedTokens(query).some((token) => haystack.toLowerCase().includes(token));
}

function matchesText(source: Source, query: string): boolean {
  const haystack = [source.id, source.title, source.source_class, source.steward].join(" ");
  return normalizedTokens(query).some((token) => haystack.toLowerCase().includes(token));
}

function normalizedTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((token) => token.length > 2);
}
