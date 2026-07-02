/**
 * Composition root — the one module that wires concrete adapters into a default
 * Context Layer service. Core (`contextService` + the ports) stays adapter-free;
 * only this module runs discovery and assembles the registry/resources.
 *
 * Since plan 018 G5 the registry + resource records are the OUTPUT of discovery,
 * not the `data/*.yaml` seed: we probe every spine service's Terraform module and
 * crawl the security-policy Confluence space, then derive the Sources + resource
 * records from what was found. Discovery is the SINGLE live path — dev/
 * integration point `CONFLUENCE_*` / `TERRAFORM_*` at the MSW
 * fixtures; prod points them at the real systems. An unconfigured channel yields
 * an honest-empty catalog, never a fabricated in-code fixture.
 */
import type { Guidance, ResourceContextRecord } from "@atlas/schema";
import { deriveGuardrailResources } from "./discovery/deriveGuardrails";
import { deriveRegistry } from "./discovery/deriveRegistry";
import { deriveServiceResources } from "./discovery/deriveResources";
import { discoverGuardrails, type DiscoveredGuardrail } from "./discovery/discoverGuardrails";
import { discoverServiceSources, type DiscoveredService } from "./discovery/discoverSources";
import { createFeedbackRepository } from "./repositories/feedbackRepositoryFactory";
import type { Registry } from "./registry/registry";
import { availabilityMatrixResolver } from "./resolvers/availabilityMatrixResolver";
import { confluencePageResolver } from "./resolvers/confluencePageResolver";
import { policyDocumentResolver } from "./resolvers/policyDocumentResolver";
import { createResolverRegistry } from "./resolvers/resolverRegistry";
import { terraformModuleResolver } from "./resolvers/terraformModuleResolver";
import { defaultResolutionContext, type FetchLike } from "./resolvers/resolverTypes";
import { withFetchLogging, withResolverLogging } from "./observability/logging";
import {
  createConfluenceReferenceDiscovery,
  type ConfluenceReferenceInstance,
} from "./sourceContent/confluenceReferenceDiscovery";
import { createOnboardingGuidanceSource } from "./sourceContent/confluenceOnboardingProvider";
import { createConfluenceAvailabilityProvider } from "./sourceContent/confluenceAvailabilityProvider";
import type { AvailabilityProvider } from "./services/availabilityProvider";
import type { ResourceReferenceDiscovery } from "./services/resourceReferenceDiscovery";
import type { ContextService, ContextServiceOptions } from "./services/contextService";

/** Late-bound fetch (re-reads `globalThis.fetch` per call) so the dev/integration
 *  MSW interceptor is always picked up, and prod uses the real fetch (plan 018). */
const liveFetch: FetchLike = withFetchLogging(
  (input, init) => globalThis.fetch(input, init as RequestInit) as ReturnType<FetchLike>,
);

/** Discovery output — the descriptive facts the registry/resources derive from. */
type Discovered = { services: DiscoveredService[]; guardrails: DiscoveredGuardrail[] };

// Memoize discovery so repeated `createDefaultContextService()` in one process is
// cheap (each route builds a fresh service per request, but they share one live
// discovery pass). Keyed by the discovery-relevant env so a test that re-points
// the channels re-discovers rather than serving a stale catalog.
let discoveryCache: { key: string; promise: Promise<Discovered> } | undefined;

/**
 * Parse the explicit service→module map (`TERRAFORM_MODULE_MAP`, a JSON object of
 * `identity.key` → module name). Malformed / non-object JSON is an honest empty map
 * (no modules bound), never a thrown discovery pass.
 */
function parseModuleMap(raw: string | undefined): Record<string, string> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const map: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.length > 0) {
        map[key] = value;
      }
    }
    return map;
  } catch {
    return {};
  }
}

function discoveryKey(env: Record<string, string | undefined>): string {
  return [
    env.TERRAFORM_BASE_URL,
    env.TERRAFORM_TOKEN,
    env.TERRAFORM_ORG,
    env.TERRAFORM_MODULE_MAP,
    env.CONFLUENCE_BASE_URL,
    env.CONFLUENCE_TOKEN,
    env.CONFLUENCE_EMAIL,
    env.CONFLUENCE_SECURITY_SPACE_KEY,
    env.CONFLUENCE_SECURITY_BASE_URL,
    env.CONFLUENCE_SECURITY_TOKEN,
    env.CONFLUENCE_AVAILABILITY_PAGE_AWSF,
    env.CONFLUENCE_AVAILABILITY_PAGE_AZURE,
  ].join("|");
}

/** Run the two live discovery passes (service modules + guardrail space). */
async function runDiscovery(
  env: Record<string, string | undefined>,
  availabilityProvider: AvailabilityProvider,
): Promise<Discovered> {
  const ctx = defaultResolutionContext(); // late-bound fetch → MSW/prod
  const services = await discoverServiceSources({
    availabilityProvider,
    ctx,
    terraform: {
      baseUrl: env.TERRAFORM_BASE_URL ?? "",
      token: env.TERRAFORM_TOKEN ?? "",
      org: env.TERRAFORM_ORG ?? "",
      moduleMap: parseModuleMap(env.TERRAFORM_MODULE_MAP),
    },
  });
  const guardrails = await discoverGuardrails({
    ctx,
    confluence: {
      // Security policies may live in a separate Confluence instance — allow a
      // dedicated base URL / token / email, each falling back to the main channel.
      baseUrl: env.CONFLUENCE_SECURITY_BASE_URL ?? env.CONFLUENCE_BASE_URL ?? "",
      token: env.CONFLUENCE_SECURITY_TOKEN ?? env.CONFLUENCE_TOKEN ?? "",
      email: env.CONFLUENCE_SECURITY_EMAIL ?? env.CONFLUENCE_EMAIL,
      spaceKey: env.CONFLUENCE_SECURITY_SPACE_KEY ?? "",
    },
  });
  return { services, guardrails };
}

/**
 * Discover (memoized) unless the caller injected a custom `availabilityProvider`
 * — an injected spine isn't captured by the env key, so it always re-discovers.
 */
function discoverAll(
  env: Record<string, string | undefined>,
  availabilityProvider: AvailabilityProvider,
  useCache: boolean,
): Promise<Discovered> {
  if (!useCache) {
    return runDiscovery(env, availabilityProvider);
  }
  const key = discoveryKey(env);
  if (discoveryCache?.key !== key) {
    discoveryCache = { key, promise: runDiscovery(env, availabilityProvider) };
  }
  return discoveryCache.promise;
}

/**
 * Single live reference-discovery path (plan 018): build the live Confluence CQL
 * adapter from environment config. Returns `undefined` when the Confluence channel
 * is unconfigured — an honest absence (empty references + null state downstream),
 * never a fabricated in-code fixture.
 */
function createReferenceDiscoveryFromEnv(
  env: Record<string, string | undefined>,
): ResourceReferenceDiscovery | undefined {
  const baseUrl = env.CONFLUENCE_BASE_URL;
  const token = env.CONFLUENCE_TOKEN;
  const spaceKeys = (env.CONFLUENCE_SPACE_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
  if (!baseUrl || !token) {
    return undefined;
  }

  // Security policies are per-service references too (a policy page whose title
  // hits the service + a policy doc-type word). When they live in a SEPARATE
  // Confluence instance (its own base URL / credentials), recall it as an extra
  // channel. A security space on the SAME instance needs no special handling —
  // it's just another entry in CONFLUENCE_SPACE_KEYS (same creds), so we don't
  // fold it here (that would couple guardrail discovery's space key to reference
  // discovery and recall a second, redundant time).
  const securitySpaceKey = env.CONFLUENCE_SECURITY_SPACE_KEY;
  const securityBaseUrl = env.CONFLUENCE_SECURITY_BASE_URL;
  const extraInstances: ConfluenceReferenceInstance[] = [];
  if (securitySpaceKey && securityBaseUrl && securityBaseUrl !== baseUrl) {
    extraInstances.push({
      baseUrl: securityBaseUrl,
      token: env.CONFLUENCE_SECURITY_TOKEN ?? token,
      email: env.CONFLUENCE_SECURITY_EMAIL ?? env.CONFLUENCE_EMAIL,
      spaceKeys: [securitySpaceKey],
    });
  }

  if (spaceKeys.length === 0 && extraInstances.length === 0) {
    return undefined;
  }
  return createConfluenceReferenceDiscovery(
    { baseUrl, token, email: env.CONFLUENCE_EMAIL, spaceKeys, extraInstances },
    { fetch: liveFetch },
  );
}

/**
 * One source of guidance: the onboarding journey authored as a Confluence page,
 * addressed by `CONFLUENCE_GUIDANCE_ONBOARDING_PAGE_ID` over the shared Confluence
 * channel. Its `<h1>` sections are parsed into a stepper journey whose steps carry
 * the page's content (see `confluenceOnboardingProvider`). Returns `[]` when the
 * channel is unconfigured — an honest empty result the portal loader merges with
 * the guidance store, never a fabricated in-code fixture.
 */
export async function loadConfluenceGuidance(
  env: Record<string, string | undefined> = readProcessEnv(),
): Promise<Guidance[]> {
  const baseUrl = env.CONFLUENCE_BASE_URL;
  const token = env.CONFLUENCE_TOKEN;
  const pageId = env.CONFLUENCE_GUIDANCE_ONBOARDING_PAGE_ID;
  if (!baseUrl || !token || !pageId) {
    return [];
  }
  return createOnboardingGuidanceSource(
    { baseUrl, token, email: env.CONFLUENCE_EMAIL, pageId },
    { fetch: liveFetch },
  ).load();
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}

/**
 * Default Context Layer service for the routes. Async because the registry +
 * resource records come from live discovery (plan 018 G5): probe Terraform
 * modules over the availability spine, crawl the guardrail Confluence space, then
 * derive the Sources + resource records. Injected ports/registry/resources
 * still override discovery (the test/adapter seam).
 */
export async function createDefaultContextService(
  options: ContextServiceOptions = {},
): Promise<ContextService> {
  const env = options.env ?? readProcessEnv();
  const availabilityProvider =
    options.availabilityProvider ??
    createConfluenceAvailabilityProvider({ fetch: liveFetch, env: options.env });

  const { services, guardrails } = await discoverAll(
    env,
    availabilityProvider,
    !options.availabilityProvider,
  );

  const registry: Registry =
    options.registry ??
    deriveRegistry(
      services,
      guardrails,
      options.feedbackRepository ?? createFeedbackRepository(env, []),
    );

  const resources: ResourceContextRecord[] = options.resources ?? [
    ...deriveServiceResources(services),
    ...deriveGuardrailResources(guardrails),
  ];

  return {
    registry,
    resolvers: createResolverRegistry(
      [
        terraformModuleResolver,
        confluencePageResolver,
        policyDocumentResolver,
        availabilityMatrixResolver,
      ].map(withResolverLogging),
    ),
    availabilityProvider,
    referenceDiscovery: options.referenceDiscovery ?? createReferenceDiscoveryFromEnv(env),
    resources,
    now: new Date(),
  };
}
