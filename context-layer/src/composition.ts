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
import type { DiscoveredGuardrail } from "./discovery/discoverGuardrails";
import type { DiscoveredService } from "./discovery/discoverSources";
import { reconstructDiscovery } from "./discovery/projectDiscovery";
import { InMemorySnapshotStore } from "./graph/snapshotStore";
import { InMemoryEventsRepository } from "./repositories/eventsRepository";
import { serveRootSnapshots } from "./graph/serveSnapshots";
import { createFeedbackRepository } from "./repositories/feedbackRepositoryFactory";
import type { Registry } from "./registry/registry";
import { availabilityMatrixResolver } from "./resolvers/availabilityMatrixResolver";
import { confluencePageResolver } from "./resolvers/confluencePageResolver";
import { policyDocumentResolver } from "./resolvers/policyDocumentResolver";
import { createResolverRegistry } from "./resolvers/resolverRegistry";
import { terraformModuleResolver } from "./resolvers/terraformModuleResolver";
import type { FetchLike } from "./resolvers/resolverTypes";
import { createResolutionContext } from "./resolvers/createResolutionContext";
import {
  logger,
  serializeError,
  withFetchLogging,
  withResolverLogging,
} from "./observability/logging";
import {
  createConfluenceReferenceDiscovery,
  type ConfluenceReferenceInstance,
} from "./sourceContent/confluenceReferenceDiscovery";
import {
  createResourceContentDiscovery,
  type ResourceContentDiscovery,
} from "./resources/resourceContentDiscovery";
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

/**
 * Parse the explicit service→module map (`TERRAFORM_MODULE_MAP`, a JSON object of
 * `identity.key` → module name(s)). A value may be a single module name or a list
 * (a service can have several modules); both normalize to a string list. Malformed
 * / non-object JSON is an honest empty map (no modules bound), never a throw.
 */
function parseModuleMap(raw: string | undefined): Record<string, string[]> {
  const log = logger("discovery");
  if (!raw) {
    // Unset is a legitimate honest-empty (no modules mapped) — not an error, but
    // worth an info so a "0 TFE fetches" investigation can rule it out.
    log.info("TERRAFORM_MODULE_MAP is unset — no service is mapped to a module (0 probes)");
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      log.warn(
        { rawLength: raw.length },
        "TERRAFORM_MODULE_MAP parsed to a non-object — every service maps to no module (0 probes)",
      );
      return {};
    }
    const map: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const names = (Array.isArray(value) ? value : [value]).filter(
        (name): name is string => typeof name === "string" && name.length > 0,
      );
      if (names.length > 0) {
        map[key] = names;
      }
    }
    log.info(
      { serviceKeys: Object.keys(map).length, modules: Object.values(map).flat().length },
      `TERRAFORM_MODULE_MAP parsed: ${Object.keys(map).length} service key(s) → ${Object.values(map).flat().length} module name(s)`,
    );
    return map;
  } catch (error) {
    // Malformed JSON (a common ECS env-quoting failure) silently degraded to an
    // empty map before — the single likeliest reason for "0 TFE fetches" despite
    // every TERRAFORM_* var being set. Make it loud.
    log.error(
      { rawLength: raw.length, err: serializeError(error) },
      "TERRAFORM_MODULE_MAP is not valid JSON — no service is mapped to a module (0 probes)",
    );
    return {};
  }
}

/**
 * Serve the descriptive discovery facts (services + guardrails) from the ONE
 * snapshot substrate (D3 projection inversion): read every source root through
 * the shared snapshot store (warm ⇒ 0 crawls; cold/stale ⇒ crawl + CAS
 * transition inline; failed ⇒ last-good + aging), then reconstruct the
 * `DiscoveredService[]` / `DiscoveredGuardrail[]` the registry/resource
 * projections consume. When the caller injected a custom `availabilityProvider`
 * (the test/adapter seam), serve through a FRESH per-call in-memory store so the
 * injected spine is never masked by a warm shared snapshot from another env.
 */
async function serveDiscovery(
  env: Record<string, string | undefined>,
  availabilityProvider: AvailabilityProvider,
  injected: boolean,
): Promise<{ services: DiscoveredService[]; guardrails: DiscoveredGuardrail[] }> {
  // Discovery runs as the system's own governed context (no caller identity):
  // the factory wires the process-shared cache + late-bound fetch (MSW/prod).
  const ctx = await createResolutionContext({ env });
  const { snapshots } = await serveRootSnapshots({
    ctx,
    availabilityProvider,
    env,
    ...(injected
      ? { store: new InMemorySnapshotStore(), events: new InMemoryEventsRepository() }
      : {}),
  });
  return reconstructDiscovery(snapshots);
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

  // Parse the module map ONCE — the lazy content enricher reuses it to fetch a
  // service's README on detail (list discovery binds addresses off the snapshot).
  const moduleMap = parseModuleMap(env.TERRAFORM_MODULE_MAP);

  const { services, guardrails } = await serveDiscovery(
    env,
    availabilityProvider,
    Boolean(options.availabilityProvider),
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

  // Lazy per-resource content (plan 0.2.0): the guardrail slug→pageId map is
  // captured from the space listing so the enricher fetches exactly the one page a
  // policy read needs; services enrich via the same module map list discovery used.
  const contentDiscovery: ResourceContentDiscovery =
    options.contentDiscovery ??
    createResourceContentDiscovery({
      terraform: {
        baseUrl: env.TERRAFORM_BASE_URL ?? "",
        token: env.TERRAFORM_TOKEN ?? "",
        org: env.TERRAFORM_ORG ?? "",
        moduleMap,
      },
      guardrail: {
        baseUrl: env.CONFLUENCE_SECURITY_BASE_URL ?? env.CONFLUENCE_BASE_URL ?? "",
        token: env.CONFLUENCE_SECURITY_TOKEN ?? env.CONFLUENCE_TOKEN ?? "",
        email: env.CONFLUENCE_SECURITY_EMAIL ?? env.CONFLUENCE_EMAIL,
      },
      guardrailPageIds: new Map(guardrails.map((guardrail) => [guardrail.slug, guardrail.pageId])),
    });

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
    contentDiscovery,
    resources,
    now: new Date(),
  };
}
