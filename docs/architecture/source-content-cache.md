# Source-content cache

Live source resolution fetches Confluence pages or Terraform READMEs over the
network. The cache is a performance layer and never becomes the source of
truth. Confluence uses a cheap `head`/version check followed by a revisioned
content entry; Terraform and other generic GETs use the normal response cache.
Here `head` means the lightweight metadata/version lookup: the current
Confluence v2 adapter sends `GET /pages/{id}` without `body-format=storage`;
it is not an HTTP `HEAD` request.

## Goal and non-goals

**Goal:** avoid downloading an unchanged source body while retaining an honest
freshness boundary and caller-ACL isolation.

**Non-goals:**

- Not offline/source-down resilience. If a required live head check fails, the
  resolver returns `source_unavailable`; old content is not presented as
  current.
- Not durable persistence. Valkey is shared cache capacity only; the source
  remains Confluence/Terraform.
- Not a bundle-level cache. Registry and request-local parse memoization remain
  separate concerns.

## Where it sits

`cachedResolutionContext()` creates one shared `SourceContentCache` and exposes
both the generic cached `fetch` and the source-cache seam on `ResolutionContext`.
The HTTP and in-process entry points reuse that context, while tests can keep
using `defaultResolutionContext()` without any cache.

Confluence owns the version-aware policy:

```
Confluence request
        │
        ├─ head/version (short validation TTL)
        │       └─ same revision → revision content (long TTL)
        └─ changed/missing → storage body → write content first, then head

Terraform / other GETs: ResolutionContext.fetch = withCache(realFetch, cache)
```

The cache stores response-shaped JSON, not parsed excerpts. One page can serve
many anchors, so the body is shared before the CPU-only HTML parse.

```ts
interface SourceContentCache {
  get(key: string): Promise<CachedResponse | undefined>;
  set(key: string, value: CachedResponse, ttlSeconds: number): Promise<void>;
}
type CachedResponse = { status: number; body: unknown; freshUntil?: number };
```

- Default: `InMemoryContentCache`, a bounded `Map` with per-entry expiry.
- Production: `ValkeyContentCache`, enabled only when `CACHE_VALKEY_URL` is
  configured.

## Cache keys and caller identity

Generic GET keys include `method + url + sha256(Authorization)`. The raw token
is never stored or logged. This keeps Confluence ACLs isolated between caller
identities; Terraform's service token naturally coalesces.

Confluence versioned keys use a SHA-256 identity digest and a Valkey hash tag:

```
atlas:source-content:{identity}:head
atlas:source-content:{identity}:revision:v7-confluence-storage-v1
```

The hash tag keeps head and revision keys in one cluster slot. Both stay under
the existing `atlas:source-content:*` IAM ACL prefix.

Only GET requests are cached. Non-GET methods pass through. An internal bypass
header lets the Confluence policy avoid the generic 300-second body cache; the
header is stripped before the request leaves Atlas.

## Freshness contract

1. **Two source windows.** Confluence head validation defaults to 300 seconds
   (`CACHE_VALIDATION_TTL_SECONDS`); revision content defaults to seven days
   (`CACHE_CONTENT_TTL_SECONDS`). A content entry is usable only after a fresh
   head confirms the same revision. Head expiry triggers a metadata request, not
   an unconditional body download.
2. **Revision materialization.** A changed or uncached head causes one storage
   body request. The revision body is written before the head pointer, so a head
   never points at a body that has not been attempted.
   Concurrent same-identity requests coalesce in-process; a distributed Valkey
   refresh lock is still a follow-up for multi-task stampede control.
3. **No stale-as-current fallback.** A head outage returns `source_unavailable`.
   This preserves the live-authority contract in ADR-0009/0013. A separate
   Portal stale/offline display policy may be added later without changing this
   API contract.
4. **Fail-open cache.** Cache read/write failures bypass the cache and continue
   to the live source. Cache availability cannot turn a source read into a 5xx.
5. **Negative responses.** Generic non-OK responses use
   `CACHE_NEGATIVE_TTL_SECONDS` (30 seconds by default) to avoid hot failure
   loops without hiding a later recovery.
6. **Drift remains visible.** `stale_source` is computed from Source review
   metadata and live version information; the cache does not rewrite that signal.

## Adapter: ElastiCache Valkey

> **Status.** Implemented. `valkeyContentCache.ts` uses iovalkey's cluster
> client with SigV4-generated ElastiCache IAM credentials.

iovalkey receives the ElastiCache configuration endpoint as a seed address,
discovers the cluster topology, routes commands by slot, handles MOVED/ASK
redirects and failover retries, and enables TLS. The adapter generates a new
15-minute IAM token every 14 minutes, opens the replacement cluster before the
old token expires, then closes the previous connection. This keeps the token
rotation explicit without requiring a platform-specific native module.

This is intentionally a connection rotation rather than an in-place AUTH
refresh. The cache is an optimization, the ECS process is short-lived, and the
rotation window is well below the AWS token lifetime; a real VPC/TLS/IAM/cluster
smoke test is still required before claiming deployment readiness.

Terraform provisions a TLS-enabled, cluster-mode Valkey replication group and
restricts the ECS task role to the IAM user and replication group. Leaving
`CACHE_VALKEY_URL` unset selects the bounded in-memory fallback.

`CACHE_VALKEY_URL` must be `rediss://host:6379`; IAM auth requires TLS. Cache
name, region, and IAM user id are separate inputs because IAM signs the
replication-group id rather than the DNS endpoint. Values are JSON-serialized
`CachedResponse`s and use `SET ... EX seconds`.

## Environment variables

| Variable                       | Default               | Purpose                                       |
| ------------------------------ | --------------------- | --------------------------------------------- |
| `CACHE_VALKEY_URL`             | _(unset)_             | `rediss://…`; selects Valkey, else in-memory. |
| `CACHE_VALKEY_CACHE_NAME`      | _(required with URL)_ | ElastiCache replication-group id.             |
| `CACHE_VALKEY_REGION`          | _(required with URL)_ | AWS region for IAM signing.                   |
| `CACHE_VALKEY_USER_ID`         | _(required with URL)_ | IAM-enabled ElastiCache username.             |
| `CACHE_TTL_SECONDS`            | `300`                 | Generic successful GET TTL.                   |
| `CACHE_NEGATIVE_TTL_SECONDS`   | `30`                  | Generic non-OK response TTL.                  |
| `CACHE_VALIDATION_TTL_SECONDS` | `300`                 | Confluence head/version validation TTL.       |
| `CACHE_CONTENT_TTL_SECONDS`    | `604800`              | Confluence revision content TTL (7 days).     |
| `CACHE_MAX_ENTRIES`            | `500`                 | In-memory adapter bound (ignored by Valkey).  |

## Implementation and verification

1. `SourceContentCache` interface, bounded in-memory implementation, and
   auth-scoped generic GET decorator.
2. Memoized shared context wired into HTTP, in-process, discovery, and
   availability paths.
3. Confluence head/version plus revision-content cache with fail-open writes,
   hash-tagged cluster keys, and no stale-as-current fallback.
4. `ValkeyContentCache` using iovalkey Cluster + SigV4 IAM token rotation,
   gated by `CACHE_VALKEY_URL`, plus Terraform env wiring.
5. Tests for cold fetch, same-revision hit, version change, head outage,
   generic hard expiry/single-flight, cache-backend failure, and the iovalkey
   adapter lifecycle/token rotation using an injected fake client. A real
   Valkey integration test still needs deployment credentials and VPC access.
