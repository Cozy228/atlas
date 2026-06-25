# Plan 010: Trim the SSR availability payload on projection-only routes

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If
> anything in "STOP conditions" occurs, stop and report — do not improvise. When
> done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bcfabcc..HEAD -- portal/src/routes/index.tsx portal/src/routes/catalog.index.tsx portal/src/routes/catalog.\$topicId.tsx portal/src/routes/availability.index.tsx`
> If any in-scope file changed, compare the "Current state" excerpts to the live
> loaders before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (changes SSR dehydration + a warm-nav fetch trade-off — read the
  trade-off below before starting)
- **Depends on**: 006 (to measure the HTML payload before/after). **Reconcile with
  007** — both edit the `catalog.$topicId` loader; land 007 first, then apply 010's
  availability swap inside the restructured loader.
- **Category**: perf (data loading — first-byte payload)
- **Planned at**: commit `bcfabcc`, 2026-06-25

## Why this matters

`availabilityQueryOptions` returns the **entire** availability matrix (all zones ×
all services × all locations). Three routes call `ensureQueryData(availabilityQueryOptions)`
in their loaders but only render a small **projection** of it; only
`availability.index` renders the full grid. Because `ensureQueryData` populates the
query cache and TanStack's SSR-query integration dehydrates that cache into the
initial HTML, **every cold landing on `/`, `/catalog`, and `/catalog/$id` ships the
full matrix JSON in the HTML** — 15–25 KB uncompressed of data the page never reads
— on top of the projection the loader already returns. On the audit's target (slow,
proxied link, first paint is the painful moment) this is pure dead weight at the
worst possible time. This plan stops those three routes from dehydrating the full
matrix, while `availability.index` (which actually needs it) is unchanged.

Confirmed safe: `rg "useSuspenseQuery|useQuery"` shows the availability query has
**exactly one** subscriber — `availability.index.tsx:125`. The other three routes
read only `Route.useLoaderData()` (a projection), so removing the full query from
their dehydrated cache breaks no component.

## Trade-off (decide before Step 1)

Today these loaders use `ensureQueryData(availabilityQueryOptions)` with
`staleTime: Infinity`, so after the first load a **warm** client-side navigation to
`/` or `/catalog` re-reads the cache with **no** network call. The primary fix
(call the server fn directly + project) removes the cold-landing dehydration bloat
but means a warm client-nav re-invokes the availability server fn each visit.

- **Primary approach (recommended for the slow-network target)**: accept the warm
  re-fetch. Availability is a matrix projection (an availability-matrix resolver /
  registry read — *not* the expensive Confluence path), cached server-side by plan
  008. Saving ~20 KB on every cold first paint outweighs one cheap warm call,
  especially since most users never open the full matrix.
- **Alternative (if zero warm-nav cost is required)**: add per-route
  server-projected summary queries (`fetchHomeAvailabilitySummary`, etc.) that
  return only the projection, cached + dehydrated small. More code (a new server fn
  per slice, because each route needs a different projection); only do this if a
  reviewer rejects the warm re-fetch. The Maintenance section sketches it.

Record which approach you took in the commit message.

## Current state

- **`portal/src/routes/index.tsx:30-86`** — home loader:
  ```ts
  const [availability, feed] = await Promise.all([
    context.queryClient.ensureQueryData(availabilityQueryOptions),
    context.queryClient.ensureQueryData(announcementsQueryOptions),
  ]);
  // …projects availability → domain counts / regionCount; returns HomeLoaderData (no raw matrix)
  ```
  Uses `availability.zones.find(...)`, `zone.services`, `zone.locations`,
  `availability.zones.reduce(...)`. The component `HomeRoute` reads
  `Route.useLoaderData()` only.
- **`portal/src/routes/catalog.index.tsx:22-31`** — catalog index loader:
  ```ts
  const [topicsResp, availability] = await Promise.all([
    context.queryClient.ensureQueryData(topicDiscoveryQueryOptions),
    context.queryClient.ensureQueryData(availabilityQueryOptions),
  ]);
  const zone = availability.zones.find((entry) => entry.id === "aws") ?? availability.zones[0]!;
  return { topics: topicsResp.topics, zone };
  ```
  Returns one `zone` (a `LandingZoneData`), not the whole matrix. Component reads
  `Route.useLoaderData()`.
- **`portal/src/routes/catalog.$topicId.tsx:57-97`** — detail loader fetches
  availability in the `Promise.all`, then uses `availability.zones[0]` (defaultZone)
  and `availability.zones.length`. (After plan 007 this loader is restructured; apply
  010 to whatever form it has then.)
- **`portal/src/api/queries.ts:11,42-46`** — `availabilityQueryOptions`
  (`staleTime: Infinity`) and the directly-callable server fn:
  `import { fetchAvailability, type AvailabilityResponse } from "@/api/server/availability"`,
  and `availabilityQueryOptions.queryFn = () => fetchAvailability()`. So
  `await fetchAvailability()` is the same call without the cache/dehydration.
- **`portal/src/routes/availability.index.tsx:125`** — the **only** subscriber:
  `useSuspenseQuery(availabilityQueryOptions)`. **Leave this route unchanged** — it
  needs the full matrix cached + dehydrated.

## Commands you will need

| Purpose | Command (from `portal/`) | Expected |
|---------|--------------------------|----------|
| Install | `pnpm install` (repo root) | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | exit 0 |
| Build | `pnpm build` | exit 0 |
| HTML payload check | `pnpm build && node .output/server/index.mjs &` then `curl -s localhost:3000/ \| wc -c` and `curl -s localhost:3000/ \| grep -c '"availability"'` | home HTML smaller; matrix markers gone (see Step 4) |

(Confirm the serve command + port from the repo README / `package.json` during the
drift check; `node .output/server/index.mjs` is the documented serve entry.)

## Scope

**In scope** (the only files you should modify):
- `portal/src/routes/index.tsx` — loader only.
- `portal/src/routes/catalog.index.tsx` — loader only.
- `portal/src/routes/catalog.$topicId.tsx` — loader only (reconcile with 007).

**Out of scope** (do NOT touch):
- `portal/src/routes/availability.index.tsx` — the legitimate full-matrix consumer.
- `portal/src/api/queries.ts` — `availabilityQueryOptions` stays for
  `availability.index`; do not remove it.
- The projection logic itself (domain grouping, zone selection) — keep it identical;
  only its *input* changes from `ensureQueryData(...)` to `fetchAvailability()`.
- Component render code / loader return shapes — unchanged.

## Git workflow

- Branch: `advisor/010-trim-ssr-availability`.
- Conventional commits, e.g. `perf(portal): stop dehydrating full availability matrix on projection-only routes`.
  No `Co-Authored-By` trailer (husky rejects it).
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Home loader — fetch directly, don't cache the matrix

In `portal/src/routes/index.tsx`, import the server fn and replace the
`ensureQueryData(availabilityQueryOptions)` call. Keep announcements as-is (small,
and rendered). Keep all projection logic identical.

```ts
import { fetchAvailability } from "@/api/server/availability";
// …
const [availability, feed] = await Promise.all([
  fetchAvailability(),
  context.queryClient.ensureQueryData(announcementsQueryOptions),
]);
```

(Remove the now-unused `availabilityQueryOptions` import from this file if nothing
else uses it — `pnpm lint` will flag it.)

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0. `grep -n "availabilityQueryOptions" portal/src/routes/index.tsx` → no matches.

### Step 2: Catalog index loader — same swap

```ts
import { fetchAvailability } from "@/api/server/availability";
// …
const [topicsResp, availability] = await Promise.all([
  context.queryClient.ensureQueryData(topicDiscoveryQueryOptions) as Promise<TopicDiscoveryResponse>,
  fetchAvailability(),
]);
```

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.

### Step 3: Catalog detail loader — same swap (after 007)

In `portal/src/routes/catalog.$topicId.tsx`, replace
`context.queryClient.ensureQueryData(availabilityQueryOptions)` with
`fetchAvailability()` wherever it appears in the (post-007) loader. Keep
`topicDiscoveryQueryOptions`, `guidanceQueryOptions`, and the contextBundle call on
`ensureQueryData` (those are still cache-worthy and either rendered or covered by
007). Remove the unused `availabilityQueryOptions` import if nothing else needs it.

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0; `pnpm test` → exit 0.

### Step 4: Prove the payload shrank

Build and inspect the home HTML for the matrix markers. The dehydrated matrix shows
up as a large `"availability"`-keyed blob inside the router/query dehydration script.

- `pnpm build` then serve (`node .output/server/index.mjs`, confirm port).
- Compare `curl -s localhost:<port>/ | wc -c` before vs after (use git stash to get
  the "before"), and confirm the full per-location availability objects
  (e.g. a `"status":"available"` cluster repeated across services) no longer appear
  in `/` and `/catalog`. They MUST still appear in `/availability`.

**Verify**: home HTML byte count drops materially (record the delta in
`docs/architecture/perf-baseline.md`); `/availability` HTML still contains the
matrix; `pnpm test` → exit 0.

## Test plan

- No behaviour change to test — projections are identical, only their data source
  moved off the dehydrated cache. Rely on `pnpm typecheck` + `pnpm lint` + `pnpm test`.
- If route loader tests exist (`grep -rl "index\|catalog" portal/src --include=*.test.* | xargs grep -l "loader"`),
  run them; they assert projected shape, which is unchanged.
- The real proof is Step 4's HTML byte delta — record it.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0; `pnpm test` exits 0; `pnpm build` exits 0.
- [ ] `index.tsx`, `catalog.index.tsx`, `catalog.$topicId.tsx` loaders call
      `fetchAvailability()` (not `ensureQueryData(availabilityQueryOptions)`).
- [ ] `availability.index.tsx` is unmodified and still uses
      `useSuspenseQuery(availabilityQueryOptions)`.
- [ ] `grep -rn "availabilityQueryOptions" portal/src/routes/` matches only
      `availability.index.tsx`.
- [ ] Home (`/`) HTML no longer contains the full per-location matrix; `/availability` still does (Step 4).
- [ ] Only the three in-scope loaders are modified (`git status --short`).
- [ ] `plans/README.md` status row for 010 updated (note the approach + HTML delta).

## STOP conditions

Stop and report (do not improvise) if:

- `grep` finds any component under the home/catalog subtrees subscribing via
  `useSuspenseQuery(availabilityQueryOptions)` or `useQuery(availabilityQueryOptions)`
  — then that route *does* need the cached query and the swap would break it.
- `fetchAvailability` cannot be awaited directly in a loader (type/runtime error) —
  report rather than reintroducing `ensureQueryData`.
- Removing the matrix from `/` HTML also removes it from `/availability` (you touched
  the wrong call) — revert and isolate the change to the three projection routes.
- The warm-nav re-fetch trade-off is deemed unacceptable by a reviewer — switch to
  the summary-query alternative (Maintenance) and re-scope.

## Maintenance notes

- **Summary-query alternative** (zero warm-nav cost): add per-route server fns that
  return only the projection (`fetchHomeAvailabilitySummary` → domains/counts;
  `fetchCatalogZone` → one `LandingZoneData`), wrap each in its own
  `queryOptions({ staleTime: Infinity })`, and have the loaders `ensureQueryData`
  those. The projection moves server-side; cold HTML carries only the small summary;
  warm nav stays cache-served. More code, but no warm re-fetch. Choose this only if
  the primary trade-off is rejected.
- The same double-ship pattern *could* apply to `topics`/`guidance` dehydration, but
  those are smaller and usually rendered in full — only revisit if 006's HTML-size
  capture flags them.
- A reviewer should confirm `/availability` is untouched and that the home/catalog
  projections are byte-identical to before (same numbers on screen).
