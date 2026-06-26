# Plan 007: `contextBundle` staleTime + detail-route loader parallelism

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the next
> step. If anything in "STOP conditions" occurs, stop and report — do not
> improvise. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bcfabcc..HEAD -- portal/src/api/queries.ts portal/src/routes/catalog.\$topicId.tsx portal/src/routes/guidance.\$guidanceId.tsx portal/src/routes/sources.\$sourceId.tsx`
> If any in-scope file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 006 (only to record before/after numbers — 007 is safe to land alone)
- **Category**: perf (data loading)
- **Planned at**: commit `bcfabcc`, 2026-06-25

## Why this matters

`contextBundleQueryOptions` is the **single most expensive call in the app**: it
resolves every cited anchor on a topic's sources, and when the real providers are
wired each anchor is a Confluence/Terraform fetch + parse. Today that query has
**no `staleTime`**, so React Query treats it as immediately stale and the loader
re-issues it on **every** mount/navigation to a detail route — re-paying the full
external cost to render data the user just saw. On a slow, proxied, TLS-inspected
corporate link each such call is seconds. Two detail-route loaders also serialise
fetches that could overlap, adding avoidable round-trips on cold/deep-link loads.
This plan makes the bundle cache like the other stable registry data and removes
the two avoidable waterfalls — all one- or two-line changes, no behaviour change
for a user.

## Current state

- **`portal/src/api/queries.ts:68-73`** — the bundle query, missing `staleTime`
  (compare the registry queries above it, which set `staleTime: 60_000` or
  `Infinity`):
  ```ts
  export function contextBundleQueryOptions(request: ContextRequest) {
    return queryOptions<ContextBundleResponse>({
      queryKey: ["context-bundle", request] as const,
      queryFn: () => fetchContextBundle({ data: request }),
    });
  }
  ```
  For reference, `guidanceQueryOptions`/`availabilityQueryOptions` use
  `staleTime: Infinity` (lines 34-46) and `topics`/`sources` use
  `staleTime: 60_000`. The QueryClient default is `staleTime: 60_000`
  (`portal/src/router.tsx:11`). (Note: React Query hashes `["context-bundle", request]`
  structurally, so two structurally-equal `request` objects share one cache
  entry — object identity is not a concern.)

- **`portal/src/routes/catalog.$topicId.tsx:56-98`** — the bundle is awaited as a
  **sequential tail** after the first `Promise.all`:
  ```ts
  const [topicsResp, availability, guidances] = await Promise.all([
    context.queryClient.ensureQueryData(topicDiscoveryQueryOptions),
    context.queryClient.ensureQueryData(availabilityQueryOptions),
    context.queryClient.ensureQueryData(guidanceQueryOptions),
  ]);
  const topic = topicsResp.topics.find((entry) => entry.id === params.topicId);
  if (!topic) throw notFound();
  let bundle: ContextBundleResponse | null = null;
  try {
    bundle = await context.queryClient.ensureQueryData(
      contextBundleQueryOptions({ topic_id: topic.id, disclosure_level: 2 }),
    );
  } catch (error) { /* topic_not_found | source_not_found → bundle = null; else rethrow */ }
  ```
  The bundle genuinely **cannot** join the first `Promise.all` (it needs
  `topic.id`, which comes from `topicsResp`). But `availability` and `guidances`
  do **not** depend on `topics`, so the bundle can overlap them.

- **`portal/src/routes/guidance.$guidanceId.tsx:21-27`** — two **independent**
  queries awaited in series:
  ```ts
  const guidances = await context.queryClient.ensureQueryData(guidanceQueryOptions);
  const guidance = resolveGuidanceFlow(guidances, params.guidanceId);
  if (!guidance) throw notFound();
  const sourcesResp = await context.queryClient.ensureQueryData(sourceDiscoveryQueryOptions);
  return { guidance, sources: sourcesResp.sources };
  ```
  `sourceDiscoveryQueryOptions` does not depend on `guidances`; they can run in
  parallel. (The only reason they're sequential is the `notFound()` early-exit —
  acceptable to fetch sources for a 404 guidance, which is rare.)

- **`portal/src/routes/sources.$sourceId.tsx`** — also consumes
  `contextBundleQueryOptions` (benefits from the `staleTime` change; confirm its
  loader shape during the drift check, but no waterfall change is required there
  unless you find the same sequential-tail pattern).

## Commands you will need

| Purpose | Command (from `portal/`) | Expected |
|---------|--------------------------|----------|
| Install | `pnpm install` (repo root) | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0, no errors |
| Lint | `pnpm lint` | exit 0 |
| Tests | `pnpm test` | exit 0 |
| Counter (from 006) | `pnpm exec vitest run scripts/measure-bundle-fetch-count.debug.test.ts` (in `context-layer/`) | fewer external fetches on re-nav, if 006 landed |

## Scope

**In scope** (the only files you should modify):
- `portal/src/api/queries.ts` — add `staleTime` to `contextBundleQueryOptions`.
- `portal/src/routes/catalog.$topicId.tsx` — overlap the bundle fetch with
  availability + guidance.
- `portal/src/routes/guidance.$guidanceId.tsx` — parallelise the two independent
  queries.

**Out of scope** (do NOT touch):
- The `try/catch` error mapping in `catalog.$topicId.tsx` (the
  `topic_not_found`/`source_not_found` → `null` behaviour must be preserved
  exactly — it is the contract for "topic exists but has no resolvable sources").
- `contextApi.ts` / the server functions — caching belongs in the query options,
  not the transport.
- Any change to `disclosure_level: 2` — that level is deliberate (resolves all
  anchors so the datasheet "References" can show every cited section).

## Git workflow

- Branch: `advisor/007-context-bundle-staletime`.
- One commit for the `staleTime` change, one for each loader refactor (or one
  logical commit) — conventional commits, e.g. `perf(portal): cache contextBundle and parallelise detail loaders`. No `Co-Authored-By` trailer (husky rejects it).
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Give `contextBundle` a `staleTime`

In `portal/src/api/queries.ts`, add `staleTime` to `contextBundleQueryOptions`.
Bundles are keyed by an immutable `{ topic_id, disclosure_level }` and do not
change within a session, so cache them like the other stable registry data:

```ts
export function contextBundleQueryOptions(request: ContextRequest) {
  return queryOptions<ContextBundleResponse>({
    queryKey: ["context-bundle", request] as const,
    queryFn: () => fetchContextBundle({ data: request }),
    staleTime: 5 * 60_000, // 5 min: bundles are stable per session; avoids re-resolving every anchor on re-nav
  });
}
```

Use `5 * 60_000` (not `Infinity`) so a long-lived tab eventually refreshes if the
underlying source content changes — this is the conservative choice versus the
`Infinity` used for `guidance`/`availability`. If a STOP-condition reviewer prefers
`Infinity` for parity, that is acceptable; document which you chose in the commit.

**Verify**: `pnpm typecheck` → exit 0. `grep -n "staleTime" portal/src/api/queries.ts`
shows the new line inside `contextBundleQueryOptions`.

### Step 2: Overlap the bundle fetch in the catalog datasheet loader

In `portal/src/routes/catalog.$topicId.tsx`, fetch `topics` first (needed for
`topic.id` and the `notFound()` gate), then run availability + guidance + bundle
concurrently. Preserve the `try/catch` mapping exactly — move it to wrap the
`Promise.all` and re-derive `bundle` from the settled result, or keep a helper
that returns `null` on the two tolerated error codes. Target shape:

```ts
const topicsResp = await context.queryClient.ensureQueryData(topicDiscoveryQueryOptions);
const topic = topicsResp.topics.find((entry) => entry.id === params.topicId);
if (!topic) throw notFound();

const bundlePromise = context.queryClient
  .ensureQueryData(contextBundleQueryOptions({ topic_id: topic.id, disclosure_level: 2 }))
  .catch((error) => {
    if (error instanceof ContextApiError &&
        (error.code === "topic_not_found" || error.code === "source_not_found")) {
      return null;
    }
    throw error;
  });

const [availability, guidances, bundle] = await Promise.all([
  context.queryClient.ensureQueryData(availabilityQueryOptions),
  context.queryClient.ensureQueryData(guidanceQueryOptions),
  bundlePromise,
]);
```

Keep the existing `return { topic, related, guidance, bundle, defaultZone, totalZones }`
shape and the downstream `.find`/`.filter` derivations unchanged.

**Verify**: `pnpm typecheck` → exit 0. `pnpm test` → exit 0 (no test asserts the
sequential order; if one does, STOP and report). Manually confirm the `try/catch`
codes `topic_not_found` and `source_not_found` are still the only ones swallowed:
`grep -n "topic_not_found\|source_not_found" portal/src/routes/catalog.\$topicId.tsx` → both present.

### Step 3: Parallelise the guidance detail loader

In `portal/src/routes/guidance.$guidanceId.tsx`, start both independent queries
together, then apply the `notFound()` gate:

```ts
const [guidances, sourcesResp] = await Promise.all([
  context.queryClient.ensureQueryData(guidanceQueryOptions),
  context.queryClient.ensureQueryData(sourceDiscoveryQueryOptions),
]);
const guidance = resolveGuidanceFlow(guidances, params.guidanceId);
if (!guidance) throw notFound();
return { guidance, sources: sourcesResp.sources };
```

**Verify**: `pnpm typecheck` → exit 0. `pnpm test` → exit 0.

## Test plan

- No new behaviour to test (caching + fetch ordering are transparent). Rely on
  `pnpm typecheck` + `pnpm test` + `pnpm lint` staying green.
- If the repo has loader tests for these routes (`grep -rl "guidance.\$guidanceId\|catalog.\$topicId" portal/src --include=*.test.*`),
  run them specifically and confirm they pass; they assert data shape, not order.
- Optional proof: if plan 006 landed, re-run its bundle-fetch counter and confirm a
  second navigation to the same topic issues **0** new external resolver calls
  (vs N before this plan).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0; `pnpm lint` exits 0; `pnpm test` exits 0 (in `portal/`).
- [ ] `contextBundleQueryOptions` in `portal/src/api/queries.ts` sets a `staleTime`.
- [ ] `catalog.$topicId.tsx` issues the bundle fetch inside (or concurrently with)
      the availability/guidance `Promise.all`, and still maps
      `topic_not_found`/`source_not_found` to `bundle = null`.
- [ ] `guidance.$guidanceId.tsx` fetches `guidance` + `sources` via one `Promise.all`.
- [ ] No files outside the in-scope list are modified (`git status --short`).
- [ ] `plans/README.md` status row for 007 updated.

## STOP conditions

Stop and report (do not improvise) if:

- A test asserts the **order** of loader fetches (the refactor changes order) —
  report it rather than rewriting the test.
- `ContextApiError` or its `.code` values differ from the "Current state" excerpt
  (the error-mapping must stay byte-for-byte equivalent).
- `sources.$sourceId.tsx` turns out to mutate the bundle request shape in a way
  that the `staleTime` would cache incorrectly (e.g. a per-render changing field) —
  report before changing it.
- Typecheck reveals `ensureQueryData(...).catch(...)` returns a type that breaks
  the `Promise.all` tuple — keep the explicit `: ContextBundleResponse | null`
  annotation on the bundle promise.

## Maintenance notes

- If `contextBundle` ever gains a mutable field in its request (e.g. a
  user-specific disclosure), revisit the `staleTime` — a 5-minute cache is wrong
  for per-interaction-varying requests.
- The `staleTime` here interacts with `defaultPreloadStaleTime: 0`
  (`router.tsx:20`): hover-preload will re-run the loader but `ensureQueryData`
  now short-circuits within the 5-minute window, so preload no longer re-resolves
  anchors. This is the intended effect (it closes finding B-1).
- A reviewer should confirm the catalog loader's error semantics in the PR — that
  is the one place a careless refactor could swallow a real error.
