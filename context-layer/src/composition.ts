/**
 * Composition root — the one module that wires concrete adapters into a default
 * Context Layer service. Core (`contextService` + the ports) stays
 * adapter-free; only this module imports `adapters/dev`. A production build
 * swaps the dev factories below for live adapters — the single seam where the
 * runtime chooses live sources over the dev manifests. Core stays unaware.
 */
import type { ResourceContextRecord } from "@atlas/schema";
import { createDevRegistry, createDevSourceContentProvider } from "./adapters/dev";
import { availabilityMatrixResolver } from "./resolvers/availabilityMatrixResolver";
import { confluencePageResolver } from "./resolvers/confluencePageResolver";
import { policyDocumentResolver } from "./resolvers/policyDocumentResolver";
import { createResolverRegistry } from "./resolvers/resolverRegistry";
import { terraformModuleResolver } from "./resolvers/terraformModuleResolver";
import { loadResources } from "./adapters/dev/loadResources";
import { createConfluenceReferenceDiscovery } from "./sourceContent/confluenceReferenceDiscovery";
import { createConfluenceAvailabilityProvider } from "./sourceContent/confluenceAvailabilityProvider";
import type { ResourceReferenceDiscovery } from "./services/resourceReferenceDiscovery";
import type { FetchLike } from "./resolvers/resolverTypes";
import type { ContextService, ContextServiceOptions } from "./services/contextService";

// The default resource records come from the dev adapter's resource loader. The
// loader reads + validates the filesystem, so we memoize it: the routes build a
// fresh service per request and must not re-read/parse YAML each time.
let cachedResources: ResourceContextRecord[] | undefined;

function getDefaultResources(): ResourceContextRecord[] {
  return (cachedResources ??= loadResources());
}

/** Late-bound fetch (re-reads `globalThis.fetch` per call) so the dev/integration
 *  MSW interceptor is always picked up, and prod uses the real fetch (plan 018). */
const liveFetch: FetchLike = (input, init) =>
  globalThis.fetch(input, init as RequestInit) as ReturnType<FetchLike>;

/**
 * Single live reference-discovery path (plan 018): build the live Confluence CQL
 * adapter from environment config. Returns `undefined` when the Confluence channel
 * is unconfigured — an honest absence (empty references + null state downstream),
 * never a fabricated in-code fixture. dev/integration point `ATLAS_CONFLUENCE_*`
 * at the MSW source-space fixture; prod points them at the real site.
 */
function createReferenceDiscoveryFromEnv(
  env: Record<string, string | undefined> = readProcessEnv(),
): ResourceReferenceDiscovery | undefined {
  const baseUrl = env.ATLAS_CONFLUENCE_BASE_URL;
  const token = env.ATLAS_CONFLUENCE_TOKEN;
  const spaceKeys = (env.ATLAS_CONFLUENCE_SPACE_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  if (!baseUrl || !token || spaceKeys.length === 0) {
    return undefined;
  }
  return createConfluenceReferenceDiscovery(
    { baseUrl, token, email: env.ATLAS_CONFLUENCE_EMAIL, spaceKeys },
    { fetch: liveFetch },
  );
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}

/**
 * Default Context Layer service for the routes. Dev adapters fill any port the
 * caller does not inject; behaviour is identical to the previous in-service
 * factory — only the adapter wiring moved out of core into this composition root.
 */
export function createDefaultContextService(options: ContextServiceOptions = {}): ContextService {
  return {
    registry:
      options.registry ??
      createDevRegistry({ env: options.env, feedbackRepository: options.feedbackRepository }),
    resolvers: createResolverRegistry([
      terraformModuleResolver,
      confluencePageResolver,
      policyDocumentResolver,
      availabilityMatrixResolver,
    ]),
    contentProvider: options.contentProvider ?? createDevSourceContentProvider(),
    availabilityProvider:
      options.availabilityProvider ??
      createConfluenceAvailabilityProvider({ fetch: liveFetch, env: options.env }),
    referenceDiscovery: options.referenceDiscovery ?? createReferenceDiscoveryFromEnv(options.env),
    resources: options.resources ?? getDefaultResources(),
    now: new Date(),
  };
}
