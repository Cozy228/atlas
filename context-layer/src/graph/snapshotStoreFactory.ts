/**
 * The process-shared snapshot store (Step 2, M2/M10). Selects the durable
 * {@link ValkeySnapshotStore} when `CACHE_VALKEY_URL` is set (sharing the
 * EXISTING content-cache Valkey — no new infra, no new env), else the in-memory
 * store for dev/tests. Memoized per env-hash so the discovery snapshot pass
 * (write) and every reader resolve THIS instance, and a test that re-points the
 * channels rebuilds rather than serving a stale store.
 *
 * Resilience is CONSTRUCTION-TIME selection, not per-op fallback (decision 5):
 * `CACHE_VALKEY_URL` set ⇒ Valkey; unset ⇒ in-memory; a connection failure at
 * construction falls back to in-memory with a loud pino error. A runtime op
 * error is handled INSIDE {@link ValkeySnapshotStore} (safe value, never a hidden
 * second store — a per-op memory fallback would split-brain the CAS).
 *
 * A construction that fell back to in-memory during a TRANSIENT outage is not
 * memoized forever: {@link sharedSnapshotStore} remembers the fallback as a
 * STABLE in-memory instance and, after `SNAPSHOT_STORE_RETRY_MS`, retries the
 * Valkey construction — recovering to the durable store on success, keeping the
 * SAME in-memory instance on continued failure (no cold-storm). When
 * `CACHE_VALKEY_URL` is unset this retry logic never runs (plain in-memory).
 *
 * Key scheme: `discovery:{<envHash>}:<rootId>` — the `{<envHash>}` braces are a
 * Valkey hash tag so the pair keys and the roots index share one cluster slot
 * (see valkeySnapshotStore.ts).
 */
import { createHash } from "node:crypto";

import { logger, serializeError } from "../observability/logging";
import { InMemorySnapshotStore, type SnapshotStore } from "./snapshotStore";
import { ValkeySnapshotStore } from "./valkeySnapshotStore";
import type { CreateSnapshotClientDeps } from "./valkeySnapshotClient";

const log = logger("graph");

/** After a transient connect failure fell back to in-memory, retry the Valkey
 *  construction no more often than this (ms). */
export const SNAPSHOT_STORE_RETRY_MS = 60_000;

/** The discovery-relevant env, hashed into the snapshot keyspace so a different
 *  source-system config (dev fixtures vs prod) never collides on the same keys.
 *  Includes the credential envs the parsers authenticate with (token/email), so
 *  rotating to a token with different ACL visibility re-prefixes rather than
 *  serving snapshots parsed under the old identity. The material is sha256-hashed
 *  and truncated, so no secret leaks into the key. Also keys the read-path
 *  single-flight (`serveSnapshots.ts`). */
export function snapshotEnvHash(env: Record<string, string | undefined>): string {
  const material = [
    env.CACHE_VALKEY_URL,
    env.TERRAFORM_BASE_URL,
    env.TERRAFORM_ORG,
    env.TERRAFORM_MODULE_MAP,
    env.TERRAFORM_TOKEN,
    env.CONFLUENCE_BASE_URL,
    env.CONFLUENCE_TOKEN,
    env.CONFLUENCE_EMAIL,
    env.CONFLUENCE_SECURITY_BASE_URL,
    env.CONFLUENCE_SECURITY_SPACE_KEY,
    env.CONFLUENCE_SECURITY_ROOT_PAGE_ID,
    env.CONFLUENCE_SECURITY_TOKEN,
    env.CONFLUENCE_SECURITY_EMAIL,
    env.CONFLUENCE_AVAILABILITY_PAGE_AWSF,
    env.CONFLUENCE_AVAILABILITY_PAGE_AZURE,
  ].join("|");
  return createHash("sha256").update(material).digest("hex").slice(0, 16);
}

/**
 * Build the snapshot store for one env (not memoized — {@link sharedSnapshotStore}
 * memoizes). `deps` injects the Valkey client factory for tests so the Valkey
 * branch is exercised without a live server. The Valkey client module is
 * dynamic-imported only when a URL is set, so the in-memory path never loads the
 * native GLIDE binary.
 */
export async function createSnapshotStore(
  env: Record<string, string | undefined>,
  deps: CreateSnapshotClientDeps = {},
): Promise<SnapshotStore> {
  const url = env.CACHE_VALKEY_URL;
  if (!url) {
    return new InMemorySnapshotStore();
  }
  try {
    const { createSnapshotClient } = await import("./valkeySnapshotClient");
    const client = await createSnapshotClient(env, url, deps);
    return new ValkeySnapshotStore(client, `discovery:{${snapshotEnvHash(env)}}`);
  } catch (error) {
    // Construction failed (unreachable endpoint): fall back to the per-task
    // in-memory store with a loud error. Each task re-discovers on cold start and
    // the durable, idempotent `events` store collapses duplicate derivation.
    log.error(
      { err: serializeError(error) },
      "snapshot Valkey store construction failed; falling back to in-memory (per-task, non-durable)",
    );
    return new InMemorySnapshotStore();
  }
}

/** The memoized shared state per env-hash. `degraded` is true only when a Valkey
 *  URL is set but construction fell back to in-memory; then `store` IS the stable
 *  in-memory fallback and `lastAttemptMs` gates the retry backoff. */
type SharedState = {
  store: SnapshotStore;
  degraded: boolean;
  lastAttemptMs: number;
};

let shared: Promise<SharedState> | undefined;
let sharedKey: string | undefined;
/** Synchronous mirror of the last RESOLVED state, so a healthy entry is served
 *  from the SAME memoized promise with no per-call chaining (concurrent cold
 *  readers stay in lockstep for the single-flight); only a degraded entry past
 *  the retry window reassigns `shared`. */
let sharedState: SharedState | undefined;

/**
 * The process-shared snapshot store for one env. Memoized per env-hash; a Valkey
 * construction that fell back to in-memory during a transient outage is retried
 * after `SNAPSHOT_STORE_RETRY_MS` (recovering to the durable store on success,
 * keeping the SAME in-memory instance on continued failure). `nowMs`/`deps` are
 * injectable for tests.
 */
export function sharedSnapshotStore(
  env: Record<string, string | undefined>,
  nowMs: () => number = Date.now,
  deps: CreateSnapshotClientDeps = {},
): Promise<SnapshotStore> {
  const key = snapshotEnvHash(env);
  if (sharedKey !== key || shared === undefined) {
    sharedKey = key;
    sharedState = undefined;
    shared = track(buildShared(env, deps, nowMs()));
  } else if (
    sharedState?.degraded &&
    nowMs() - sharedState.lastAttemptMs >= SNAPSHOT_STORE_RETRY_MS
  ) {
    // A degraded entry past the retry window: attempt recovery ONCE. Bump the
    // attempt clock synchronously to debounce concurrent retries, and base the
    // retry on the current resolved state so the stable fallback is reused.
    const base = sharedState;
    sharedState = { ...base, lastAttemptMs: nowMs() };
    shared = track(retryConstruction(env, deps, base, nowMs()));
  }
  return shared.then((state) => state.store);
}

/** Mirror a resolving state into the synchronous `sharedState`. */
function track(p: Promise<SharedState>): Promise<SharedState> {
  return p.then((state) => {
    sharedState = state;
    return state;
  });
}

/** First construction for an env-hash: record whether it fell back to in-memory
 *  while a Valkey URL was set (⇒ degraded, retry-eligible). */
async function buildShared(
  env: Record<string, string | undefined>,
  deps: CreateSnapshotClientDeps,
  attemptMs: number,
): Promise<SharedState> {
  const store = await createSnapshotStore(env, deps);
  const degraded = Boolean(env.CACHE_VALKEY_URL) && store instanceof InMemorySnapshotStore;
  return { store, degraded, lastAttemptMs: attemptMs };
}

/** Re-attempt the Valkey construction for a degraded entry. On recovery switch to
 *  the durable store (in-memory contents are derivation cache — no migration); on
 *  continued failure keep the SAME in-memory instance (no cold-storm) and bump the
 *  timestamp. */
async function retryConstruction(
  env: Record<string, string | undefined>,
  deps: CreateSnapshotClientDeps,
  base: SharedState,
  nowMs: number,
): Promise<SharedState> {
  const store = await createSnapshotStore(env, deps);
  if (!(store instanceof InMemorySnapshotStore)) {
    log.info(
      "snapshot Valkey store recovered after a transient outage; switching from in-memory fallback to the durable store",
    );
    return { store, degraded: false, lastAttemptMs: nowMs };
  }
  return { store: base.store, degraded: true, lastAttemptMs: nowMs };
}
