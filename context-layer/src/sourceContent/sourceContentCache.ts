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
 * cluster adapter activates only when `CACHE_VALKEY_URL` is set.
 */

/**
 * The shape `FetchLike` yields, buffered so it can be replayed from cache.
 * `freshUntil` (epoch ms) is carried alongside an OK entry so a cache backend
 * that outlives an older TTL cannot replay it during a rolling deployment.
 * Expired entries are re-fetched; they are never served stale.
 */
export type CachedResponse = { status: number; body: unknown; freshUntil?: number };

export interface SourceContentCache {
  get(key: string): Promise<CachedResponse | undefined>;
  set(key: string, value: CachedResponse, ttlSeconds: number): Promise<void>;
  close?(): void | Promise<void>;
}

/** Internal marker for source adapters that own a version-aware cache policy. */
export const SOURCE_CACHE_BYPASS_HEADER = "x-atlas-source-cache-bypass";

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
 *  - fail-open storage: a cache read/write failure bypasses the cache and keeps
 *    the live source as the authority.
 *
 * Transport exceptions (a thrown `fetch`) are NEVER cached — only HTTP responses
 * with a status are stored; a throw propagates and the in-flight entry clears.
 * An OK entry is usable only until its hard TTL; stale source content is never
 * returned as a successful resolution.
 */
export function withCache(
  fetch: FetchLike,
  cache: SourceContentCache,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  negativeTtlSeconds: number = DEFAULT_NEGATIVE_TTL_SECONDS,
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
      await setCache(cache, key, value, ttlSeconds);
      return value;
    }
    const value: CachedResponse = { status: response.status, body: undefined };
    await setCache(cache, key, value, negativeTtlSeconds);
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
      pending = fetchAndStore(key, input, withoutSignal(init)).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    return pending;
  }

  return async (input, init) => {
    init?.signal?.throwIfAborted();
    const method = (init?.method ?? "GET").toUpperCase();
    if (hasCacheBypassMarker(init?.headers)) {
      return fetch(input, withoutCacheMarker(init));
    }
    if (method !== "GET") {
      return fetch(input, init);
    }

    const key = cacheKey(method, input, init?.headers);
    const hit = await getCache(cache, key);
    if (hit && isFresh(hit, now)) {
      return replay(hit);
    }

    return replay(await waitForCaller(startFetch(key, input, init), init?.signal));
  };
}

function withoutSignal(init: Parameters<FetchLike>[1]): Parameters<FetchLike>[1] {
  if (!init?.signal) return init;
  const { signal: _signal, ...sharedInit } = init;
  return sharedInit;
}

function hasCacheBypassMarker(headers: Record<string, string> | undefined): boolean {
  if (!headers) return false;
  return Object.entries(headers).some(
    ([name, value]) => name.toLowerCase() === SOURCE_CACHE_BYPASS_HEADER && value === "true",
  );
}

function withoutCacheMarker(init: Parameters<FetchLike>[1]): Parameters<FetchLike>[1] {
  if (!init?.headers) return init;
  const headers = Object.fromEntries(
    Object.entries(init.headers).filter(
      ([name]) => name.toLowerCase() !== SOURCE_CACHE_BYPASS_HEADER,
    ),
  );
  return { ...init, headers };
}

function waitForCaller<T>(pending: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return pending;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    pending.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/** A cache is an optimization; an unavailable backend must not block the source. */
async function getCache(
  cache: SourceContentCache,
  key: string,
): Promise<CachedResponse | undefined> {
  try {
    return await cache.get(key);
  } catch {
    return undefined;
  }
}

/** Cache write failures are intentionally swallowed for the same fail-open contract. */
async function setCache(
  cache: SourceContentCache,
  key: string,
  value: CachedResponse,
  ttlSeconds: number,
): Promise<void> {
  try {
    await cache.set(key, value, ttlSeconds);
  } catch {
    // The live response remains authoritative even when the cache is degraded.
  }
}

function isFresh(value: CachedResponse, now: () => number): boolean {
  return value.freshUntil === undefined || now() < value.freshUntil;
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
  return `atlas:source-content:${createHash("sha256")
    .update(`${method}\n${url}\n${authScope}`)
    .digest("hex")}`;
}

/**
 * Select the cache implementation from the environment, mirroring
 * `createFeedbackRepository`: a Valkey adapter when `CACHE_VALKEY_URL` is
 * set, otherwise the in-memory default. The adapter uses iovalkey's cluster
 * client with a short-lived IAM token rotated before expiry.
 */
export async function createSourceContentCache(
  env: Record<string, string | undefined>,
): Promise<SourceContentCache> {
  const valkeyUrl = env.CACHE_VALKEY_URL;
  if (valkeyUrl) {
    const { ValkeyContentCache } = await import("./valkeyContentCache");
    return new ValkeyContentCache({
      cacheName: requiredEnv(env, "CACHE_VALKEY_CACHE_NAME"),
      region: requiredEnv(env, "CACHE_VALKEY_REGION"),
      url: valkeyUrl,
      userId: requiredEnv(env, "CACHE_VALKEY_USER_ID"),
    });
  }
  const maxEntries = numberFromEnv(env.CACHE_MAX_ENTRIES, DEFAULT_MAX_ENTRIES);
  return new InMemoryContentCache({ maxEntries });
}

export function cacheTtlSeconds(env: Record<string, string | undefined>): number {
  return numberFromEnv(env.CACHE_TTL_SECONDS, DEFAULT_TTL_SECONDS);
}

export function cacheNegativeTtlSeconds(env: Record<string, string | undefined>): number {
  return numberFromEnv(env.CACHE_NEGATIVE_TTL_SECONDS, DEFAULT_NEGATIVE_TTL_SECONDS);
}

export function cacheValidationTtlSeconds(env: Record<string, string | undefined>): number {
  return numberFromEnv(env.CACHE_VALIDATION_TTL_SECONDS, DEFAULT_TTL_SECONDS);
}

export function cacheContentTtlSeconds(env: Record<string, string | undefined>): number {
  return numberFromEnv(env.CACHE_CONTENT_TTL_SECONDS, 7 * 24 * 60 * 60);
}

// One shared cache across every entry point — it is useless if rebuilt per
// request, so memoize it at module scope like the default registry.
let sharedCachePromise: Promise<SourceContentCache> | undefined;
let sharedResolutionContextPromise: Promise<ResolutionContext> | undefined;

function sharedCache(env: Record<string, string | undefined>): Promise<SourceContentCache> {
  return (sharedCachePromise ??= createSourceContentCache(env));
}

export async function closeSourceContentCache(): Promise<void> {
  const cachePromise = sharedCachePromise;
  sharedCachePromise = undefined;
  sharedResolutionContextPromise = undefined;
  if (!cachePromise) return;
  const cache = await cachePromise;
  await cache.close?.();
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
  return (sharedResolutionContextPromise ??= sharedCache(env).then((cache) => {
    const base = defaultResolutionContext();
    return {
      ...base,
      fetch: withCache(base.fetch, cache, cacheTtlSeconds(env), cacheNegativeTtlSeconds(env)),
      sourceCache: cache,
      sourceCachePolicy: {
        validationTtlSeconds: cacheValidationTtlSeconds(env),
        contentTtlSeconds: cacheContentTtlSeconds(env),
      },
    };
  }));
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}

function numberFromEnv(raw: string | undefined, fallback: number): number {
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.floor(parsed)) : fallback;
}

function requiredEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required when CACHE_VALKEY_URL is set.`);
  return value;
}
