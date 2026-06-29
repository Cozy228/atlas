import type {
  Source,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
  ResourceContextRecord,
} from "@atlas/schema";
import type { FeedbackRepository } from "../repositories/feedbackRepository";
import type { Registry } from "../registry/registry";
import type { ResolverRegistry } from "../resolvers/resolverRegistry";
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
    if (request.query) {
      return matchesText(source, request.query);
    }
    return true;
  });

  return { sources };
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
