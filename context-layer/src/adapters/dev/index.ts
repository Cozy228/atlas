/**
 * Dev adapter — assembles the Context Layer ports from the Git-managed
 * `data/*.yaml` seed. This is the only place the in-memory seed is loaded and
 * wired; the core depends on the ports (`Registry`, `SourceContentProvider`,
 * `AvailabilityProvider`), never on this module's provenance. A production build
 * would swap these factories for live adapters at the composition root.
 */
import type { FeedbackRepository } from "../../repositories/feedbackRepository";
import { createFeedbackRepository } from "../../repositories/feedbackRepositoryFactory";
import type { Registry } from "../../registry/registry";
import { createInMemoryRegistry, type RegistrySeed } from "./inMemoryRegistry";
import { DATA_DIR, loadRegistryFromManifests } from "./loadRegistryFromManifests";

export { createDevSourceContentProvider } from "./sourceContent";
export { createDevAvailabilityProvider } from "./availability";

export type DevRegistryOptions = {
  env?: Record<string, string | undefined>;
  feedbackRepository?: FeedbackRepository;
};

// The loader reads + validates the filesystem, so we memoize it: routes build a
// fresh service per request and must not re-read/parse YAML each time.
let cachedSeed: RegistrySeed | undefined;
function defaultSeed(): RegistrySeed {
  return (cachedSeed ??= loadRegistryFromManifests(DATA_DIR));
}

/**
 * Dev default registry port: the in-memory adapter assembled from the validated
 * `data/*.yaml` manifests, with the feedback repository selected from env (or an
 * explicitly injected one) and pre-loaded with the authored initial feedback.
 */
export function createDevRegistry(options: DevRegistryOptions = {}): Registry {
  const seed = defaultSeed();
  const feedbackRepository =
    options.feedbackRepository ??
    createFeedbackRepository(options.env ?? readProcessEnv(), seed.feedback);
  return createInMemoryRegistry(seed, { feedback: feedbackRepository });
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
