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

Both entry points build that context through one shared
`cachedResolutionContext()` (memoized so the cache is a single instance, not
rebuilt per request): the HTTP router (`handleHttpRequest`, used by external
Skill consumers and the Portal when `CONTEXT_API_BASE_URL` is set) and the
in-process route (`handleContextRequest`, the Portal's default path). A repeat
fetch is therefore served from cache regardless of entry point.
`offlineResolutionContext()` stays cache-free for tests and callers that pass
their own context.

We cache the **response body**, not the parsed excerpt. One page serves many
anchors (one per heading), so a URL-keyed response cache fetches a page once and
serves every anchor from it; a parse-result cache keyed by anchor would re-fetch
the page per anchor. The parse itself is CPU-only (single-digit ms) — cheap
beside the network fetch — and a parsed `ResolveResult` carries citation /
freshness signals we must not cache (ADR-0009). A parse memo could be layered on
top later if profiling ever shows it matters; YAGNI until then.

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

1. **Short TTL.** Default 300s (`CACHE_TTL_SECONDS`). Long enough to absorb
   a burst of repeat queries, short enough that drift surfaces on the next
   window. TTL expiry = re-fetch, never serve-stale-on-error.
2. **Drift detection is unaffected.** Review-frequency drift (`stale_source`) is
   computed at the bundle level from the Source's review metadata, not from the
   fetched bytes, so the cache cannot mask it.

The availability provider now receives the same cached `FetchLike` as resource
resolution. Its raw Confluence response therefore gets the same auth-scoped
single-flight, negative-cache, and stale-while-revalidate behavior; the Portal
also coalesces concurrent anonymous availability projections in each process.

## Adapter: ElastiCache (Valkey)

ElastiCache now offers **Valkey** (the open-source Redis fork); it is the
default new-cluster engine and is cheaper than the Redis OSS option
([AWS](https://aws.amazon.com/elasticache/what-is-valkey/)).

> **Status.** Implemented. The shipped adapter (`valkeyContentCache.ts`) uses
> the pure-JS **iovalkey cluster client** with ElastiCache IAM authentication.

**Client choice — iovalkey Cluster.** The cluster configuration endpoint seeds
topology discovery and TLS uses hostname-preserving DNS lookup. The adapter
generates the ElastiCache IAM password with SigV4, supplies the IAM user id as
the ACL username, and replaces the cluster connection at 14 minutes — before
the 15-minute token expires.

**Tradeoff (accepted):** iovalkey has no native runtime, so it can remain inside
the self-contained server artifact. It does not expose a dynamic IAM credentials
provider, so Atlas owns the short token lifecycle at the cache-adapter boundary
and rotates the whole cluster connection before expiry.

Terraform provisions a TLS-enabled, cluster-mode Valkey replication group and
restricts port 6379 ingress to the ECS task security group. An IAM-authenticated
ElastiCache user can access only `atlas:source-content:*`; the ECS task role can
connect only to that user and replication group. Leaving `CACHE_VALKEY_URL`
unset outside that deployment still selects the bounded in-memory fallback.

**Connection.** `CACHE_VALKEY_URL` must be `rediss://host:6379`; IAM auth
requires TLS. The cache name, region, and IAM user id are separate inputs because
the SigV4 token signs the replication-group id, not the DNS endpoint. TTL uses
`SET key value EX seconds`; values are JSON-serialized `CachedResponse`s.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `CACHE_VALKEY_URL` | _(unset)_ | `rediss://…`. When set, use the Valkey adapter; else in-memory. |
| `CACHE_VALKEY_CACHE_NAME` | _(required with URL)_ | Lowercase replication-group id signed into the IAM token. |
| `CACHE_VALKEY_REGION` | _(required with URL)_ | AWS region used for SigV4. |
| `CACHE_VALKEY_USER_ID` | _(required with URL)_ | IAM-enabled ElastiCache ACL user id and username. |
| `CACHE_TTL_SECONDS` | `300` | Entry TTL for both adapters. |
| `CACHE_MAX_ENTRIES` | `500` | In-memory adapter bound (ignored by Valkey). |

## Build plan

1. `SourceContentCache` interface + `CachedResponse` type.
2. `InMemoryContentCache` (bounded Map + expiry) — the default.
3. `withCache(fetch, cache, ttl)` `FetchLike` decorator (key, GET-only, OK-only).
4. `createSourceContentCache(env)` selector + a memoized `cachedResolutionContext()`
   wired into both the HTTP router and the in-process `handleContextRequest`.
5. `ValkeyContentCache` (iovalkey Cluster + IAM, gated by `CACHE_VALKEY_URL`)
   plus Terraform user-group and task-role wiring.
6. Tests: in-memory hit/miss/expiry/auth-isolation; decorator caches GET and
   skips non-OK; selector returns in-memory without config. Valkey adapter:
   `parseValkeyUrl` + a roundtrip against an injected fake client (always run),
   plus a real-server integration block gated by `CACHE_VALKEY_URL`.
