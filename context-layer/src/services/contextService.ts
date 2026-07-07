import type {
  Source,
  SourceDiscoveryRequest,
  SourceDiscoveryResponse,
  ResourceContextRecord,
} from "@atlas/schema";
import type { FeedbackRepository } from "../repositories/feedbackRepository";
import type { Registry } from "../registry/registry";
import type { ResolverRegistry } from "../resolvers/resolverRegistry";
import type { ResolutionContext } from "../resolvers/resolverTypes";
import { gateSources } from "../resolvers/appScopeGate";
import type { AvailabilityProvider } from "./availabilityProvider";
import type { ResourceReferenceDiscovery } from "./resourceReferenceDiscovery";
import type { ResourceContentDiscovery } from "../resources/resourceContentDiscovery";

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
  /** Lazy per-resource content discovery (plan 0.2.0). Optional: when unset, a
   *  resource read projects its list-derived sections without a content fetch. */
  contentDiscovery?: ResourceContentDiscovery;
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
  /** Injection seam: supply a content-discovery port (tests / live adapter). */
  contentDiscovery?: ResourceContentDiscovery;
  /** Injection seam: override the manifest-loaded resource records (tests). */
  resources?: ResourceContextRecord[];
};

export function discoverSources(
  service: ContextService,
  request: SourceDiscoveryRequest,
  ctx: Pick<ResolutionContext, "verifiedApps">,
): SourceDiscoveryResponse {
  // App-scope gate (WS4): drop `visibility:"app"` Sources the caller is not a verified
  // member of BEFORE listing — an unverified caller never sees them in the source registry.
  const sources = gateSources(service.registry.sources.list(), ctx).filter((source) => {
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
  const haystack = [source.id, source.title, source.source_class].join(" ");
  return normalizedTokens(query).some((token) => haystack.toLowerCase().includes(token));
}

function normalizedTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((token) => token.length > 2);
}
