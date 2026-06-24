import { createHash } from "node:crypto";

import {
  offlineResolutionContext,
  type FetchLike,
  type ResolutionContext,
} from "../resolvers/resolverTypes";

/**
 * Source-content cache (docs/architecture/source-content-cache.md). Removes the
 * repeat live fetch of the same Confluence page / Terraform README within a
 * short window. The default needs no infrastructure; an ElastiCache (Valkey)
 * adapter activates only when `ATLAS_CACHE_VALKEY_URL` is set.
 */

/** The shape `FetchLike` yields, buffered so it can be replayed from cache. */
export type CachedResponse = { status: number; body: unknown };

export interface SourceContentCache {
  get(key: string): Promise<CachedResponse | undefined>;
  set(key: string, value: CachedResponse, ttlSeconds: number): Promise<void>;
}

const DEFAULT_TTL_SECONDS = 300;
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
 * Only `ok` GET responses are cached; non-GET methods and non-OK responses pass
 * straight through. The caller's `Authorization` is folded into the key (as a
 * digest, never stored raw) so one identity's authorized content is never
 * served to another.
 */
export function withCache(
  fetch: FetchLike,
  cache: SourceContentCache,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): FetchLike {
  return async (input, init) => {
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      return fetch(input, init);
    }

    const key = cacheKey(method, input, init?.headers);
    const hit = await cache.get(key);
    if (hit) {
      return replay(hit);
    }

    const response = await fetch(input, init);
    if (!response.ok) {
      return response;
    }

    const body = await response.json();
    await cache.set(key, { status: response.status, body }, ttlSeconds);
    return replay({ status: response.status, body });
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
 * `createFeedbackRepository`: a Valkey adapter when `ATLAS_CACHE_VALKEY_URL` is
 * set, otherwise the in-memory default. The Valkey client defaults to GLIDE;
 * set `ATLAS_CACHE_VALKEY_CLIENT=iovalkey` to use the pure-JS fallback instead.
 * Both client modules are imported lazily so the default install pulls none.
 */
export async function createSourceContentCache(
  env: Record<string, string | undefined>,
): Promise<SourceContentCache> {
  const valkeyUrl = env.ATLAS_CACHE_VALKEY_URL;
  if (valkeyUrl) {
    if (env.ATLAS_CACHE_VALKEY_CLIENT === "iovalkey") {
      const { IoValkeyContentCache } = await import("./iovalkeyContentCache");
      return new IoValkeyContentCache({ url: valkeyUrl });
    }
    const { ValkeyContentCache } = await import("./valkeyContentCache");
    return new ValkeyContentCache({ url: valkeyUrl });
  }
  const maxEntries = numberFromEnv(env.ATLAS_CACHE_MAX_ENTRIES, DEFAULT_MAX_ENTRIES);
  return new InMemoryContentCache({ maxEntries });
}

export function cacheTtlSeconds(env: Record<string, string | undefined>): number {
  return numberFromEnv(env.ATLAS_CACHE_TTL_SECONDS, DEFAULT_TTL_SECONDS);
}

// One shared cache across every entry point — it is useless if rebuilt per
// request, so memoize it at module scope like the registry seed.
let sharedCachePromise: Promise<SourceContentCache> | undefined;

function sharedCache(env: Record<string, string | undefined>): Promise<SourceContentCache> {
  return (sharedCachePromise ??= createSourceContentCache(env));
}

/**
 * The default resolution context for live source resolution, with `fetch`
 * wrapped by the shared cache. Used by both the HTTP router and the in-process
 * route, so a repeat Confluence/Terraform fetch is served from cache regardless
 * of entry point. `offlineResolutionContext()` stays cache-free for tests and
 * callers that pass their own context.
 */
export async function cachedResolutionContext(
  env: Record<string, string | undefined> = readProcessEnv(),
): Promise<ResolutionContext> {
  const base = offlineResolutionContext();
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
