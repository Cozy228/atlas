# Source-content cache

Live source resolution ([`live-resolution.md`](./live-resolution.md)) fetches a
Confluence page or a Terraform README over the network on every request that
reaches a live provider. Two requests for the same page within a few seconds
fetch it twice. This document specifies a cache that removes the repeat fetch,
with a default that needs no infrastructure and an ElastiCache (Valkey) adapter
that activates only when configured.

## Goal and non-goals

**Goal:** avoid re-fetching the same live source within a short window (perf +
upstream rate-limit protection). Confirmed scope.

**Non-goals:**

- **Not** offline / source-down resilience. We never serve content when the live
  source is unreachable — that would contradict the freshness contract (below).
  TTL expiry means re-fetch, not serve-stale.
- **Not** a bundle-level cache. Most of a bundle is already in-memory (registry
  is memoized, fixtures are in-process). Only the two live fetches are dear.

## Where it sits

The only network I/O is `request.ctx.fetch(...)`, called by exactly two
providers (`confluenceCloudContentProvider`, `terraformModuleContentProvider`).
So the cache is a **decorator over `FetchLike`**, injected where the
`ResolutionContext` is built. Providers are untouched — they keep calling
`ctx.fetch`; the decorator transparently serves a cached response or fetches and
stores one.

```
ResolutionContext.fetch = withCache(realFetch, cache, ttl)
                                       │
                          ┌────────────┴─────────────┐
              cache.get(key) hit?              miss → realFetch → cache.set
```

`SourceContentCache` is the storage seam:

```ts
interface SourceContentCache {
  get(key: string): Promise<CachedResponse | undefined>;
  set(key: string, value: CachedResponse, ttlSeconds: number): Promise<void>;
}
type CachedResponse = { status: number; body: unknown }; // the JSON FetchLike returns
```

- Default: `InMemoryContentCache` — a bounded `Map` with per-entry expiry. Zero
  dependencies, runs in this repo today.
- Production: `ValkeyContentCache` — ElastiCache (Valkey) over a Valkey client,
  active only when configured. See "Adapter", below.

`createSourceContentCache(env)` mirrors the existing
`createFeedbackRepository(env)` seam: return the Valkey adapter when its env var
is set, otherwise the in-memory default.

## Cache key — and why the caller token is in it

Key = `method + url + authScope`, where `authScope` is a SHA-256 digest of the
`Authorization` value (or `"anon"` when absent). **The raw token is never stored
or logged** — only its digest, and only as part of the key.

This isolation is not optional: Confluence content is governed by the caller's
own ACL ([`live-resolution.md`](./live-resolution.md)), so caller A's authorized
page must never be served from cache to caller B. Keying on the auth digest
gives each identity its own cache entry. Terraform uses a single service token,
so its entries naturally coalesce.

Only `GET` requests with `ok` responses are cached. Non-OK responses and
non-GET methods pass through uncached.

## Freshness contract

Caching and Atlas's freshness/drift honesty are reconciled by two rules:

1. **Short TTL.** Default 300s (`ATLAS_CACHE_TTL_SECONDS`). Long enough to absorb
   a burst of repeat queries, short enough that drift surfaces on the next
   window. TTL expiry = re-fetch, never serve-stale-on-error.
2. **Drift detection is unaffected.** Review-frequency drift (`stale_source`) is
   computed at the bundle level from the Source's review metadata, not from the
   fetched bytes, so the cache cannot mask it.

The availability matrix (ADR-0009) resolves from the in-process content
provider, **not** the live fetch path, so it is never cached here — consistent
with its "never a stale cached matrix" rule.

## Adapter: ElastiCache (Valkey)

ElastiCache now offers **Valkey** (the open-source Redis fork); it is the
default new-cluster engine and is cheaper than the Redis OSS option
([AWS](https://aws.amazon.com/elasticache/what-is-valkey/)).

> **Status.** Implemented. The shipped adapter (`valkeyContentCache.ts`) uses
> **GLIDE** (`@valkey/valkey-glide`).

**Client choice — GLIDE.** We use **`@valkey/valkey-glide`** (GLIDE), the
AWS-recommended client for ElastiCache: a Rust-core, multi-language client with
cluster topology auto-discovery, IAM auth, and best-practice defaults baked in
([AWS blog](https://aws.amazon.com/blogs/database/introducing-valkey-glide-an-open-source-client-library-for-valkey-and-redis-open-source/)).

**Tradeoff (accepted):** GLIDE ships **platform-native binaries** (e.g.
`@valkey/valkey-glide-linux-musl-x64`), whereas the pure-JS `iovalkey` does not.
As an optional, lazily-imported dependency neither lands in the default install,
so the native binary only matters in the runtime that actually turns the cache
on — acceptable given ElastiCache itself is operator/live territory.

**Fallback: `iovalkey` (present, not enabled).** A full pure-JS adapter
(`iovalkeyContentCache.ts`) is kept for runtimes where GLIDE's native binaries
are a problem. It is **not** active by default — `createSourceContentCache`
selects it only when `ATLAS_CACHE_VALKEY_CLIENT=iovalkey`. The seam is identical
(both implement `SourceContentCache`), so the switch is config-only and touches
no callers. `iovalkey` reads `rediss://` from the URL and enables TLS itself, so
it needs no `parseValkeyUrl`.

**Optional dependency.** `@valkey/valkey-glide` stays a non-hard dependency: the
adapter `await import("@valkey/valkey-glide")` lazily, only when
`ATLAS_CACHE_VALKEY_URL` is set, and throws a clear "install @valkey/valkey-glide"
error if configured-on but absent. The default install pulls no Valkey client
("leave it when config is on").

**Connection (GLIDE target).** `ATLAS_CACHE_VALKEY_URL` is a `rediss://host:6379`
URL parsed into GLIDE's `{ addresses: [{host, port}], useTLS }` config
(`rediss://` ⇒ `useTLS: true`, required for ElastiCache in-transit encryption,
[AWS](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/connect-tls.html)).
TTL uses `client.set(key, value, { expiry: { type: TimeUnit.Seconds, count } })`
([SetOptions](https://valkey.io/valkey-glide/node/Commands/type-aliases/SetOptions/)).
Values are JSON-serialized `CachedResponse`s.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `ATLAS_CACHE_VALKEY_URL` | _(unset)_ | `rediss://…`. When set, use the Valkey adapter; else in-memory. |
| `ATLAS_CACHE_VALKEY_CLIENT` | `glide` | Valkey client when the URL is set: `glide` (default) or `iovalkey` (pure-JS fallback). |
| `ATLAS_CACHE_TTL_SECONDS` | `300` | Entry TTL for both adapters. |
| `ATLAS_CACHE_MAX_ENTRIES` | `500` | In-memory adapter bound (ignored by Valkey). |

## Build plan

1. `SourceContentCache` interface + `CachedResponse` type.
2. `InMemoryContentCache` (bounded Map + expiry) — the default.
3. `withCache(fetch, cache, ttl)` `FetchLike` decorator (key, GET-only, OK-only).
4. `createSourceContentCache(env)` selector; wire into context construction.
5. `ValkeyContentCache` (lazy `@valkey/valkey-glide` import, gated by
   `ATLAS_CACHE_VALKEY_URL`).
6. Tests: in-memory hit/miss/expiry/auth-isolation; decorator caches GET and
   skips non-OK; selector returns in-memory without config. Valkey adapter:
   `parseValkeyUrl` + a roundtrip against an injected fake client (always run),
   plus a real-server integration block gated by `ATLAS_CACHE_VALKEY_URL`
   (skipped unless a live Valkey + the GLIDE package are present).
