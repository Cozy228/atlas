# Plan 008: Source-content cache resilience — single-flight · negative cache · stale-while-revalidate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bcfabcc..HEAD -- context-layer/src/sourceContent/sourceContentCache.ts context-layer/src/sourceContent/sourceContentCache.test.ts`
> If the cache file changed since this plan was written, compare the "Current
> state" excerpt against the live `withCache` before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (touches the live fetch path for every source resolution)
- **Depends on**: 006 (for the external-fetch-count before/after)
- **Category**: perf (parsing / resolving — external round-trips)
- **Planned at**: commit `bcfabcc`, 2026-06-25

## Why this matters

`withCache` is the only thing standing between a context-bundle request and a live
Confluence/Terraform fetch+parse. Today it has three holes that each multiply the
number of those expensive external round-trips — the dominant cost for the target
user on a slow, proxied link:

1. **No single-flight (D-1)** — N concurrent misses for the same page issue N
   identical external fetches (a thundering herd on cold/expired entries).
2. **No negative caching (D-4)** — only `ok` GETs are cached, so a hot broken or
   forbidden anchor (404/403) re-hits the external system on *every* request.
3. **No stale-while-revalidate (D-3)** — a request just past TTL blocks
   synchronously on the full fetch+parse instead of serving the last-good copy and
   refreshing in the background.

All three are fixed inside one module without changing the cache interface or any
caller. This is the highest-leverage change in the audit for the expensive path.

## Current state

`context-layer/src/sourceContent/sourceContentCache.ts` — the whole `withCache`
and its helpers, verbatim at `bcfabcc`:

```ts
const DEFAULT_TTL_SECONDS = 300;

export type CachedResponse = { status: number; body: unknown };

export interface SourceContentCache {
  get(key: string): Promise<CachedResponse | undefined>;
  set(key: string, value: CachedResponse, ttlSeconds: number): Promise<void>;
}

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
      return response;            // <-- D-4: negatives never cached
    }
    const body = await response.json();
    await cache.set(key, { status: response.status, body }, ttlSeconds);
    return replay({ status: response.status, body });
  };
}

function replay(cached: CachedResponse): Awaited<ReturnType<FetchLike>> {
  return {
    ok: cached.status >= 200 && cached.status < 300,
    status: cached.status,
    json: async () => cached.body,
  };
}
```

- `cacheKey(method, url, headers)` folds the caller's `Authorization` into a
  sha256 digest (lines 109-119) — keep using it unchanged so per-identity
  isolation is preserved.
- The cache implementations (`InMemoryContentCache`, `ValkeyContentCache`,
  `IoValkeyContentCache`) all implement `get`/`set` and store a `CachedResponse`.
  **Adding an optional field to `CachedResponse` is backward-compatible** — the
  Valkey adapters serialise the whole value, so the extra field rides along.
- The shared cache is memoised at module scope (`sharedCache`, lines 148-154) and
  used by `cachedResolutionContext()` for both the HTTP and in-process routes.
- **`FetchLike`** (see `context-layer/src/resolvers/resolverTypes.ts`) returns
  `{ ok, status, json() }` — `replay` already matches that shape.
- Tests: `context-layer/src/sourceContent/sourceContentCache.test.ts` exercises
  `withCache` (GET caching, non-OK pass-through, auth-scoped keys). Read it before
  Step 1 and model the new cases on it.

## Commands you will need

| Purpose | Command (from `context-layer/`) | Expected |
|---------|----------------------------------|----------|
| Install | `pnpm install` (repo root) | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Cache tests | `pnpm exec vitest run src/sourceContent/sourceContentCache.test.ts` | all pass |
| All tests | `pnpm test` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Fetch counter (006) | `pnpm exec vitest run scripts/measure-bundle-fetch-count.debug.test.ts` | fewer fetches after this plan |

(Confirm the exact scripts with `cat context-layer/package.json` during the drift
check; the table assumes Vitest + `typecheck`/`test`/`lint` scripts like `portal/`.)

## Scope

**In scope** (the only files you should modify):
- `context-layer/src/sourceContent/sourceContentCache.ts` — `withCache`, the
  `CachedResponse` type, and a small in-flight map.
- `context-layer/src/sourceContent/sourceContentCache.test.ts` — new cases.

**Out of scope** (do NOT touch):
- `cacheKey` and the `Authorization` digest logic — identity isolation is a
  security property; keep it byte-for-byte.
- The cache implementations (`InMemoryContentCache`, Valkey adapters) — the fix
  lives entirely in `withCache`.
- `createSourceContentCache` / the Valkey-vs-memory selection — D-2 (making Valkey
  the prod default) is **infra-gated and out of scope here** (see Maintenance).
- Any resolver or `contextBundleService.ts` — anchor batching is plan 009.

## Git workflow

- Branch: `advisor/008-cache-resilience`.
- One commit per step; conventional commits, e.g.
  `perf(context-layer): single-flight + negative cache in withCache`. No
  `Co-Authored-By` trailer (husky rejects it).
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Single-flight (request coalescing) — D-1

Add an in-flight promise map so concurrent misses for the same key share one
fetch. The map is per-`withCache`-closure (one shared cache → one map, matching
the module-scoped shared cache). Target shape:

```ts
export function withCache(fetch, cache, ttlSeconds = DEFAULT_TTL_SECONDS): FetchLike {
  const inFlight = new Map<string, Promise<CachedResponse>>();

  async function fetchAndStore(key: string, input, init): Promise<CachedResponse> {
    const response = await fetch(input, init);
    const body = response.ok ? await response.json() : undefined;
    const value: CachedResponse = { status: response.status, body };
    // (negative-cache TTL applied in Step 2)
    await cache.set(key, value, ttlSeconds);
    return value;
  }

  return async (input, init) => {
    const method = init?.method ?? "GET";
    if (method !== "GET") return fetch(input, init);
    const key = cacheKey(method, input, init?.headers);

    const hit = await cache.get(key);
    if (hit) return replay(hit);

    let pending = inFlight.get(key);
    if (!pending) {
      pending = fetchAndStore(key, input, init).finally(() => inFlight.delete(key));
      inFlight.set(key, pending);
    }
    return replay(await pending);
  };
}
```

Note this **changes one behaviour deliberately**: non-OK responses now flow
through `cache.set` (Step 2 gives them a short TTL). Keep `replay` deriving `ok`
from `status` so a cached 404 still replays as `ok: false`.

**Verify**: add a test where the underlying `fetch` is a spy that resolves after a
microtask; fire 5 concurrent `wrapped(url)` calls for the same URL and assert the
spy was called **once**. `pnpm exec vitest run src/sourceContent/sourceContentCache.test.ts` → all pass.

### Step 2: Negative caching — D-4

Cache non-OK GET responses with a **short** TTL so repeated 404/403/5xx don't
re-hit the external system, while a resource that recovers is re-discovered
quickly. Add a `negativeTtlSeconds` (default 30) and choose the TTL in
`fetchAndStore`:

```ts
const DEFAULT_NEGATIVE_TTL_SECONDS = 30;
// inside fetchAndStore:
const ttl = response.ok ? ttlSeconds : negativeTtlSeconds;
await cache.set(key, { status: response.status, body }, ttl);
```

Add `negativeTtlSeconds: number = DEFAULT_NEGATIVE_TTL_SECONDS` as a `withCache`
parameter (after `ttlSeconds`). Do **not** cache transport exceptions (a thrown
`fetch`) — only HTTP responses with a status. If `fetch` throws, let it propagate
(plan 004 governs transport-failure handling); the `finally` already clears the
in-flight entry.

**Verify**: a test where `fetch` returns `{ ok: false, status: 404, json: ... }`;
call `wrapped(url)` twice; assert `fetch` was called **once** and both calls
replay `status: 404`, `ok: false`. Add a second test that a fresh `wrapped` after
the negative TTL elapses (inject a `now`/use a tiny `negativeTtlSeconds` and a
clock-controlled cache) re-fetches. `pnpm exec vitest run …` → pass.

### Step 3 (optional but recommended): Stale-while-revalidate — D-3

Serve a last-good copy instantly past its fresh window and refresh in the
background, bounded by a hard stale window. Keep the `SourceContentCache`
interface unchanged by storing a `freshUntil` timestamp **inside** the value and
setting the cache's own TTL to the longer stale window:

- Extend the type: `export type CachedResponse = { status: number; body: unknown; freshUntil?: number };`
- Add `staleTtlSeconds` (default = `ttlSeconds`, i.e. a `2×ttl` hard window) and a
  `now: () => number = Date.now` param (for tests).
- In `fetchAndStore`, set `freshUntil = now() + ttl * 1000` (OK responses only),
  and call `cache.set(key, value, ttlSeconds + staleTtlSeconds)` so the entry
  survives into the stale window.
- In the returned wrapper, when `cache.get` returns a hit:
  - if `hit.freshUntil === undefined || now() < hit.freshUntil` → fresh: `replay(hit)`.
  - else → stale: kick a **non-awaited** refresh through the single-flight path
    (`if (!inFlight.has(key)) { const p = fetchAndStore(...).finally(...); inFlight.set(key, p); }`)
    and immediately `return replay(hit)`.

Apply SWR to **OK** entries only; negative entries should expire normally (don't
serve a stale 404). If this step's complexity risks the deadline, ship Steps 1–2
and record Step 3 as a follow-up in `plans/README.md` — Steps 1–2 already remove
the herd and the negative re-hits.

**Verify**: a clock-controlled test — populate the cache, advance past `freshUntil`
but within the stale window, call `wrapped(url)`; assert it returns the stale body
**synchronously** (the value is returned before the refresh resolves) and that a
background refresh fetch fired exactly once. `pnpm exec vitest run …` → pass.

### Step 4: Full suite + counter

Run the whole context-layer suite and (if 006 landed) the fetch counter.

**Verify**: `pnpm test` → exit 0; `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.
If 006's `measure-bundle-fetch-count.debug.test.ts` exists, run it and record the
new external-fetch count in `docs/architecture/perf-baseline.md` (it should drop
for any multi-anchor/same-page or repeated-miss scenario).

## Test plan

- New `sourceContentCache.test.ts` cases: (a) concurrent-miss coalescing → one
  fetch; (b) negative-response caching → one fetch, replays the error status; (c)
  negative TTL expiry → re-fetch; (d) [Step 3] stale-serve + background refresh.
- Model setup on the existing tests in the same file (in-memory cache with an
  injected clock; a spy `FetchLike`).
- Keep the existing tests passing unchanged — they encode the auth-scoped-key and
  GET-only contract.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0; `pnpm test` exits 0 (context-layer).
- [ ] Concurrent identical misses call the underlying `fetch` exactly once (new test).
- [ ] A non-OK GET is cached briefly (new test asserts one fetch across two calls).
- [ ] `cacheKey`/`Authorization` digest is unchanged (`git diff` shows no edit to
      lines 109-119 of the original file).
- [ ] No files outside the two in-scope files are modified (`git status --short`).
- [ ] `plans/README.md` status row for 008 updated (note if Step 3 was deferred).

## STOP conditions

Stop and report (do not improvise) if:

- The Valkey adapters fail to round-trip the extended `CachedResponse` (e.g. a
  serializer that rejects the new `freshUntil` field) — Step 3 is then blocked;
  ship Steps 1–2 and report.
- A transport exception path (thrown `fetch`) would get cached under your changes
  — it must not; only HTTP responses with a status are cached.
- An existing cache test breaks in a way that implies a behaviour contract you
  didn't intend to change (especially the GET-only / auth-key tests).
- The single-flight map would be shared across **different** `Authorization`
  scopes — it must key on the full `cacheKey` (which includes the auth digest), not
  the bare URL.

## Maintenance notes

- **D-2 dependency (infra, not this plan)**: single-flight + negative cache reduce
  amplification *within* one Lambda instance. On a multi-instance fleet the
  in-memory cache is still per-instance, so the same page is fetched once per
  instance per TTL. The compounding win is making the **Valkey shared cache the
  prod default** — provision ElastiCache and set `ATLAS_CACHE_VALKEY_URL` in the
  context-layer Lambda env. That is an infra change (Terraform/VPC/SG) outside this
  package; track it as the D-2 follow-up. With Valkey as the cache, single-flight
  still matters for intra-instance concurrency.
- **D-8 (durable/warming)**: even with Valkey, the 300 s TTL means popular pages
  re-fetch every 5 min. A durable excerpt store + cache-warming is a larger
  follow-up; revisit once D-2 lands and 006's counter shows the residual.
- A reviewer should scrutinise the in-flight map's `finally` cleanup (no leaked
  promises) and that stale entries (Step 3) are never served for negative responses.
