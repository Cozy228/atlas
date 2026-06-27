/**
 * Composition root — the one module that wires concrete adapters into a default
 * Context Layer service. Core (`contextBundleService` + the ports) stays
 * adapter-free; only this module imports `adapters/dev`. A production build
 * swaps the dev factories below for live adapters — the single seam where the
 * runtime chooses live sources over the dev manifests. Core stays unaware.
 */
import type { ResourceContextRecord } from "@atlas/schema";
import {
  createDevAvailabilityProvider,
  createDevRegistry,
  createDevSourceContentProvider,
} from "./adapters/dev";
import { availabilityMatrixResolver } from "./resolvers/availabilityMatrixResolver";
import { confluencePageResolver } from "./resolvers/confluencePageResolver";
import { policyDocumentResolver } from "./resolvers/policyDocumentResolver";
import { createResolverRegistry } from "./resolvers/resolverRegistry";
import { terraformModuleResolver } from "./resolvers/terraformModuleResolver";
import { loadResources } from "./adapters/dev/loadResources";
import type {
  ContextBundleService,
  ContextBundleServiceOptions,
} from "./services/contextBundleService";

// The default resource records come from the dev adapter's resource loader. The
// loader reads + validates the filesystem, so we memoize it: the routes build a
// fresh service per request and must not re-read/parse YAML each time.
let cachedResources: ResourceContextRecord[] | undefined;

function getDefaultResources(): ResourceContextRecord[] {
  return (cachedResources ??= loadResources());
}

/**
 * Default Context Layer service for the routes. Dev adapters fill any port the
 * caller does not inject; behaviour is identical to the previous in-service
 * factory — only the adapter wiring moved out of core into this composition root.
 */
export function createDefaultContextBundleService(
  options: ContextBundleServiceOptions = {},
): ContextBundleService {
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
    availabilityProvider: options.availabilityProvider ?? createDevAvailabilityProvider(),
    resources: options.resources ?? getDefaultResources(),
    now: new Date(),
  };
}
