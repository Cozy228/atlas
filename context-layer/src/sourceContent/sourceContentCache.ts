import { createHash } from "node:crypto";

import {
  defaultResolutionContext,
  type FetchLike,
  type ResolutionContext,
} from "../resolvers/resolverTypes";

/**
 * Source-content cache (docs/architecture/source-content-cache.md). Removes the
 * repeat live fetch of the same Confluence page / Terraform README within a
 * short window. The default needs no infrastructure; an ElastiCache (Valkey)
 * adapter activates only when `CACHE_VALKEY_URL` is set.
 */

/**
 * The shape `FetchLike` yields, buffered so it can be replayed from cache.
 * `freshUntil` (epoch ms) marks the end of an OK entry's fresh window for
 * stale-while-revalidate; absent on negative entries (never served stale).
 */
export type CachedResponse = { status: number; body: unknown; freshUntil?: number };

export interface SourceContentCache {
  get(key: string): Promise<CachedResponse | undefined>;
  set(key: string, value: CachedResponse, ttlSeconds: number): Promise<void>;
}

const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_NEGATIVE_TTL_SECONDS = 30;
const DEFAULT_MAX_ENTRIES = 500;

/**
 * Bounded in-memory cache with per-entry expiry. Eviction is insertion-order
 * (oldest first) once `maxEntries` is reached — adequate for a handful of live
 * sources; swap to the Valkey adapter when a shared cache is needed.
 */
export class InMemoryContentCache implements SourceContentCache {
  private readonly store = new Map<string, { value: CachedResponse; expiresAt: number }>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: { maxEntries?: number; now?: () => number } = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
  }

  async get(key: string): Promise<CachedResponse | undefined> {
    const entry = this.store.get(key);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  async set(key: string, value: CachedResponse, ttlSeconds: number): Promise<void> {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }
    this.store.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }
}

/**
 * Wrap a `FetchLike` so GET requests are served from / stored in the cache.
 * Non-GET methods pass straight through. The caller's `Authorization` is folded
 * into the key (as a digest, never stored raw) so one identity's authorized
 * content is never served to another.
 *
 * Three resilience behaviours guard the live fetch path:
 *  - single-flight: concurrent misses for the same key share ONE underlying
 *    fetch (a per-closure in-flight map keyed on the full auth-scoped cacheKey);
 *  - negative caching: non-OK responses are cached for `negativeTtlSeconds` so a
 *    hot 404/403/5xx does not re-hit the source on every request;
 *  - stale-while-revalidate: an OK entry past its fresh window is served instantly
 *    while a background refresh runs (bounded by `staleTtlSeconds`). SWR applies
 *    to OK entries only — a negative entry is never served stale.
 *
 * Transport exceptions (a thrown `fetch`) are NEVER cached — only HTTP responses
 * with a status are stored; a throw propagates and the in-flight entry clears.
 */
export function withCache(
  fetch: FetchLike,
  cache: SourceContentCache,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  negativeTtlSeconds: number = DEFAULT_NEGATIVE_TTL_SECONDS,
  staleTtlSeconds: number = ttlSeconds,
  now: () => number = Date.now,
): FetchLike {
  // Per-closure in-flight map. Keyed on the FULL cacheKey (which includes the
  // Authorization digest) so two different auth scopes never share a fetch.
  const inFlight = new Map<string, Promise<CachedResponse>>();

  async function fetchAndStore(
    key: string,
    input: string,
    init: Parameters<FetchLike>[1],
  ): Promise<CachedResponse> {
    const response = await fetch(input, init);
    // Only OK responses carry a body and a fresh window; negatives are stored
    // bodiless with the short negative TTL and never marked fresh-bounded.
    if (response.ok) {
      const body = await response.json();
      const value: CachedResponse = {
        status: response.status,
        body,
        freshUntil: now() + ttlSeconds * 1000,
      };
      await cache.set(key, value, ttlSeconds + staleTtlSeconds);
      return value;
    }
    const value: CachedResponse = { status: response.status, body: undefined };
    await cache.set(key, value, negativeTtlSeconds);
    return value;
  }

  /** Start a single-flight fetch for `key`, deleting the entry when it settles. */
  function startFetch(
    key: string,
    input: string,
    init: Parameters<FetchLike>[1],
  ): Promise<CachedResponse> {
    let pending = inFlight.get(key);
    if (!pending) {
      pending = fetchAndStore(key, input, init).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    return pending;
  }

  return async (input, init) => {
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      return fetch(input, init);
    }

    const key = cacheKey(method, input, init?.headers);
    const hit = await cache.get(key);
    if (hit) {
      // SWR applies to OK entries only: a negative entry (no freshUntil) is
      // served as-is until it expires, never refreshed in the background.
      const isOk = hit.status >= 200 && hit.status < 300;
      const fresh = hit.freshUntil === undefined || now() < hit.freshUntil;
      if (!isOk || fresh) {
        return replay(hit);
      }
      // Stale OK entry: kick a non-awaited single-flight refresh and serve the
      // last-good copy immediately. A rejected background fetch is swallowed so
      // it cannot surface as an unhandled rejection on this hot path.
      void startFetch(key, input, init).catch(() => {});
      return replay(hit);
    }

    return replay(await startFetch(key, input, init));
  };
}

/** Reconstruct a `FetchLike` result from a buffered body (replayable json()). */
function replay(cached: CachedResponse): Awaited<ReturnType<FetchLike>> {
  return {
    ok: cached.status >= 200 && cached.status < 300,
    status: cached.status,
    json: async () => cached.body,
  };
}

function cacheKey(
  method: string,
  url: string,
  headers: Record<string, string> | undefined,
): string {
  const authorization = headers ? (headers.Authorization ?? headers.authorization) : undefined;
  const authScope = authorization
    ? createHash("sha256").update(authorization).digest("hex")
    : "anon";
  return `${method} ${url} ${authScope}`;
}

/**
 * Select the cache implementation from the environment, mirroring
 * `createFeedbackRepository`: a Valkey adapter when `CACHE_VALKEY_URL` is
 * set, otherwise the in-memory default. The Valkey client defaults to GLIDE;
 * set `CACHE_VALKEY_CLIENT=iovalkey` to use the pure-JS fallback instead.
 * Both client modules are imported lazily so the default install pulls none.
 */
export async function createSourceContentCache(
  env: Record<string, string | undefined>,
): Promise<SourceContentCache> {
  const valkeyUrl = env.CACHE_VALKEY_URL;
  if (valkeyUrl) {
    if (env.CACHE_VALKEY_CLIENT === "iovalkey") {
      const { IoValkeyContentCache } = await import("./iovalkeyContentCache");
      return new IoValkeyContentCache({ url: valkeyUrl });
    }
    const { ValkeyContentCache } = await import("./valkeyContentCache");
    return new ValkeyContentCache({ url: valkeyUrl });
  }
  const maxEntries = numberFromEnv(env.CACHE_MAX_ENTRIES, DEFAULT_MAX_ENTRIES);
  return new InMemoryContentCache({ maxEntries });
}

export function cacheTtlSeconds(env: Record<string, string | undefined>): number {
  return numberFromEnv(env.CACHE_TTL_SECONDS, DEFAULT_TTL_SECONDS);
}

// One shared cache across every entry point — it is useless if rebuilt per
// request, so memoize it at module scope like the default registry.
let sharedCachePromise: Promise<SourceContentCache> | undefined;

function sharedCache(env: Record<string, string | undefined>): Promise<SourceContentCache> {
  return (sharedCachePromise ??= createSourceContentCache(env));
}

/**
 * The default resolution context for live source resolution, with `fetch`
 * wrapped by the shared cache. Used by both the HTTP router and the in-process
 * route, so a repeat Confluence/Terraform fetch is served from cache regardless
 * of entry point. `defaultResolutionContext()` stays cache-free for tests and
 * callers that pass their own context.
 */
export async function cachedResolutionContext(
  env: Record<string, string | undefined> = readProcessEnv(),
): Promise<ResolutionContext> {
  const base = defaultResolutionContext();
  const cache = await sharedCache(env);
  return { ...base, fetch: withCache(base.fetch, cache, cacheTtlSeconds(env)) };
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}

function numberFromEnv(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
