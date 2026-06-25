# Performance iteration log (live-fetch lens)

Reviewer-owned ledger for the 006–010 performance program. Every optimization
iteration records its metrics here, captured the same way before and after.
Baseline (audit) commit: `bcfabcc`.

## Measurement lens (locked)

- **Target = the LIVE resolver path.** All resolving/caching metrics exercise
  `resolveConfluencePageLive` via a counting `ctx.fetch` (a simulated Confluence
  Cloud endpoint returning storage-format HTML, with an injected per-call
  latency `L` so wall-time deltas are meaningful). The offline pilot content map
  is **never** measured — it is an in-memory stub and says nothing about real
  external round-trip cost.
- **Optimise for:** wire bytes · main-thread ms · count + cost of live external
  round-trips. Lens: underpowered Windows laptop on a slow, proxied, TLS-inspected
  corporate link, no public CDN.
- **Production live path already wraps `ctx.fetch` in `withCache`**, so N
  *sequential* same-page anchors already collapse to 1 live fetch (2nd+ hit
  cache). The interesting axes are therefore: (a) *concurrent* same-key
  amplification (single-flight), (b) negative re-hits, (c) cross-source resolve
  wall-time (sequential Σ vs parallel max), (d) first-byte/bundle wire bytes.

## Critic metrics (adversarial regression gates — must hold, not just "improved")

- **C1 — single-flight coalescing:** fire `K` concurrent misses for one cache
  key; the underlying live fetch MUST be called exactly **1** time. Fails loudly
  if single-flight regresses or 009's parallelism reintroduces the herd.
- **C2 — bundle determinism:** the `buildContextBundle` response for a fixed seed
  MUST be byte-identical before/after the 009 parallelisation. Fails if anchor /
  source / warning ordering drifts.

## Metric ledger

Iterations: **0** = baseline (unmodified `bcfabcc`); **1** = 008 cache resilience;
**2** = 009 parallel resolution; **3** = 007 staleTime + loader parallelism;
**5+** = "optimise to the best" follow-ups. *(Plan 010 dropped — see Rejected.)*

| Metric (lower is better unless noted) | Iter 0 (base) | 1 · 008 | 2 · 009 | 3 · 007 | 5+ |
|---|---|---|---|---|---|
| **Bundle** entry chunk gzip / brotli (KB) | **125.1 / 106.2** | – | – | – | **114.0 / 96.6** ✅ A-1 |
| **Bundle** cold-`/` total over wire (gzip) | **≈251.5 KB** | – | – | – | **≈240 KB** ✅ |
| **Bundle** detail-route eager `aws-icons` (36 KB gzip) | **eager** | – | – | – | **deferred** ✅ F-3′ |
| **SSR** `/` HTML (raw / gzip) | **111.8K / 19.0K** | – | – | – | |
| **SSR** `/catalog` HTML (raw / gzip) | **89.0K / 14.7K** | – | – | – | |
| **SSR** `/availability` HTML (raw / gzip, must stay) | **330.6K / 32.8K** | – | – | – | |
| **C1** single-flight: 5 concurrent miss → live fetches | **5** | **1** ✅ | hold 1 | – | |
| neg-cache: 2× 404 → live fetches | **2** | **1** ✅ | – | – | |
| SWR: stale served sync? / bg refreshes | **no** | **yes / 1** ✅ | – | – | |
| bundle live-fetch + parse (5 same-page anchors, RAW) | **5** | – | 5 | – | **1** ✅ D-6 |
| bundle resolve wall-ms (5 anchors × 20 ms latency) | **108** | – | **24** ✅ | – | |
| **C2** bundle determinism (fixed seed) | baseline | hold | **held** ✅ | hold | |
| availability render median ms (sanity) | **AWS 10.5 / Az 5.5** | – | – | – | |
| bundle client-cache fresh window (most-expensive query) | **60 s** (inherited) | – | – | **5 min** ✅ | |
| detail-loader waterfalls (catalog / guidance) | **2** | – | – | **0** ✅ | |

`–` = not expected to move in that iteration. `→x` = target. All Iter-0 values
independently re-measured by the reviewer (not relayed from the 006 agent).

## Iteration narrative

### Iteration 0 — baseline (plan 006) ✅ captured + verified
Harness `context-layer/scripts/measure-bundle-fetch-count.debug.test.ts` (live
path, counting `ctx.fetch`); bundle inventory via `portal/scripts/print-chunk-sizes.mjs`;
SSR bytes via served prod build + `curl`. Reviewer re-ran the harness independently
→ reproduced `singleflight=5 · negative=2 · wall=108ms · live_fetches=5`. The
006 deviation (one authorized `--exclude` line in context-layer `test`) verified
to narrow CI (debug file absent from `pnpm test`). No runtime source touched.

### Iteration 1 — 008 cache resilience ✅ landed + verified
single-flight + negative cache + stale-while-revalidate, all inside `withCache`
(`context-layer/src/sourceContent/sourceContentCache.ts`). **Critic C1 gate met** —
reviewer independently reproduced `singleflight_concurrent5=1 · negative_2x404=1`
(from 5 · 2). Reviewer-verified safety: `cacheKey`/Authorization sha256 digest is
**byte-identical** (per-identity isolation preserved); the in-flight map keys on the
full auth-scoped `cacheKey`; SWR refreshes **OK entries only** and never serves a
stale negative (`!isOk || fresh → replay`); a thrown transport `fetch` is never
cached and the `finally` clears the in-flight slot (no promise leak). Full
context-layer suite 125 passed / 2 skipped; only `sourceContentCache.ts` + its test
changed. The bundle wall-time (108 ms) and RAW fetch count (5) are unchanged, as
expected — 008 hardens amplification, 009 moves the wall-time.

### Iteration 2 — 009 parallel anchor resolution ✅ landed + verified
Inner anchor loop → ordered `Promise.all`; outer sources → bounded
`mapWithConcurrency(_, 5, _)`; `authorityConflictWarnings` pushed after all settle.
**Wall-time 108 → 24 ms** (reviewer reproduced 25 ms) — latency Σ → max, 009's
headline win. **Critic C2 (determinism) PROVEN at code level**, not just by the
passing test: `mapWithConcurrency` is index-keyed (`results[index] = await fn(...)`),
so results return in input order regardless of completion; warnings/excerpts/sources
flatten in original order → byte-identical output. Reviewer noted the existing
service test pins multi-source ordering only loosely (`toContain`/length), so the
code-level proof matters; `contextBundleService.test.ts` is byte-untouched and
passes 12/12. single-flight holds at 1; RAW fetch count stays 5 (009 parallelises,
does not batch — only the deferred D-6 cuts the count). Full suite 125 passed;
only `contextBundleService.ts` changed (+ the plan's own README status row).

### Iteration 3 — 007 staleTime + loader parallelism ✅ landed + verified
`contextBundleQueryOptions` gained `staleTime: 5 * 60_000`; `catalog.$topicId.tsx`
fetches `topics` first then overlaps availability + guidance + **bundle** in one
`Promise.all`; `guidance.$guidanceId.tsx` parallelises its two independent queries.
Reviewer-verified: the bundle error mapping is byte-equivalent (only
`topic_not_found`/`source_not_found` → `null`, else rethrow); availability fetch
untouched (010 not applied); typecheck 0, lint 0, portal suite 108 passed.
**Honest scoping correction:** the QueryClient default is already
`staleTime: 60_000` (`router.tsx:11`), so the bundle was *not* refetched on every
mount (the plan's framing overstated it) — it was cached for 60 s. 007's real win is
**5× the fresh window (60 s → 5 min)** for the single most expensive query, plus
**2 detail-loader waterfalls removed** (each ≈1 RTT on a cold/deep-link load over a
proxied link). Modest but strictly positive and low-risk. No client-runtime
re-nav counter was measured (would need a portal-mount harness spying
`fetchContextBundle`); the win is structural.

### Iteration 4 — 012 / D-6 parse-once (request-scoped page cache) ✅ landed + verified
Optional request-scoped `pageCache` added to `ResolutionContext`; `buildContextBundle`
creates + threads one per bundle; `confluenceCloudContentProvider.loadConfluencePage`
memoizes fetch + `parse(html)` by page URL (the parsed `root` is shared across all
anchors → **parse-once**); `terraformModuleContentProvider.loadRegistryModule`
memoizes the registry body (README + every field anchor share one fetch). **No
`AnchorResolver.resolve` contract change.** Harness `bundle_live_fetches 5 → 1`
(reviewer reproduced). Reviewer-verified: the in-flight Promise is stored BEFORE the
first `await` (request-scoped single-flight for 009's concurrent anchors); the cache
is per-request / single-identity (no auth-key needed, no cross-request leak); a
`pageCache`-less caller gets today's behaviour (the memo is a pure optimisation, not
a correctness dependency). Critic C2 held (service test byte-untouched 12/12);
**live-extraction correctness gated by the 4 provider/resolver tests (28/28
unchanged)** since the service test only exercises the offline path. **Honest note:**
008+009 already delivered production fetch-once; D-6's realised increment is
**parse-once (server/Lambda CPU)** + RAW/cold-path fetch-once (defense-in-depth) —
the harness's RAW 5→1 makes it visible. Only 4 files changed.

### Iteration 5 — bundle size (A-1 react-table split + F-3′ lazy AWS icons) ✅ landed + verified
**A-1:** added a Rolldown group `{ name: "react-table", priority: 26 }` so
`@tanstack/react-table` (used only by the lazy availability matrix) splits out of the
eager `tanstack`/entry chunk. **Entry `index-*.js` 125.1 → 114.0 KB gzip (−11.1 KB,
−8.9%)**; new `react-table-*.js` (11.6 KB gzip) loads only on `/availability`;
`grep getCoreRowModel index-*.js` → 0. Cold-`/` total ≈251 → ≈240 KB gzip.
**F-3′:** AWS service icons made lazy + `preloadAwsServiceIcons()` (mirroring the
existing Azure lazy+preload), wired in `availability.index.tsx` (mount + AWS-zone
pointer-enter) so the **matrix preloads** but **detail routes defer** the 36 KB
`aws-icons` pack — `catalog._topicId-*.js` now has **zero** aws-icon references.
Reviewer-verified: `pnpm build` exit 0 (Nitro re-bundle OK, no `UNRESOLVED_IMPORT`);
**independent serve smoke test — `/`, `/catalog`, `/availability`, `/catalog/aws-textract`,
`/guidance` all HTTP 200** (the chunking change is production-safe — the key risk);
typecheck 0; portal suite 108 passed. Only 3 files changed. (Note: the
`print-chunk-sizes.mjs` cold-`/` summary uses a naïve `startsWith("react-")` and
mis-attributes `react-table-*` to the cold path — the entry-chunk gzip is the true
metric and it dropped.)

### Iteration 6 — React client-render audit + measurement → HANDOFF (#15 / plan 013)
Probed the client render / animation / navigation perf the earlier iterations skipped,
using the **Vercel `react-best-practices` rubric (70 rules)** + the **`agent-browser`**
React profiler (onCommitFiberRoot) + **raw-CDP throttling** (CPU 6× + Slow-4G) — the
real low-spec-Windows lens (finally completing perf-baseline §4). Measured before:
`/availability` cold TBT **446 ms**; throttled tab-switch `/`→`/availability` **189 ms
main-thread freeze** (time-to-matrix 599 ms); `/`→`/availability` re-render profile
**110,504 renders, FPS min 3, 3 drops**; icon churn `ChevronDown ×3782`. Root cause
(vetted, React Compiler is ON): **(1) eager synchronous matrix mount, (2) icon
triple-mount pipeline, (3) selection baked into `columns` → whole-matrix re-render** —
NOT virtualization, icon weight, or row count. Animations confirmed **not** the
bottleneck (composited; shimmer pauses out-of-view; Ask chat has no markdown re-parse).
Per the user, packaged as a **handoff** (issue #15 + `plans/013`) for implementation +
re-perf, with a substantiated **TanStack Table v9 (beta) + Virtual (stable)** evaluation:
v9's `<table.Subscribe>`/atoms are the idiomatic fix for (3) but it's beta → do (3) in
v8 with CSS now, track v9 for when it's stable; Virtual not first-choice (≤59 rows,
table→grid restructure). Re-perf harness committed: `portal/scripts/perf/*.mjs`.

## Considered & rejected (with evidence — do not re-run)

- **Plan 010 / finding C-3 ("`/`, `/catalog`, `/catalog/$id` ship the full
  availability matrix in SSR HTML; ~15–25 KB unused first-byte payload")** —
  **REJECTED, premise empirically false.** Served the prod build and `curl`'d the
  routes: `/` and `/catalog` HTML contain **zero** availability markers
  (`zones`/`services`/`locations`/`us-east-1`/`status` all 0 occurrences); only
  `/availability` carries the serialized matrix (TanStack stream refs
  `…locations:$R[17]=[$R[18]={id:"us-east-1"…`). Root cause: `router.tsx` uses
  `setupRouterSsrQueryIntegration`, which serializes only queries with an **active
  `useSuspenseQuery` subscriber** — `/availability:125` is the **only** subscriber.
  The projection routes call `ensureQueryData(...)` in the loader and return a
  small projection (`HomeLoaderData`), so the raw matrix is **never dehydrated**
  there. 010's swap (`ensureQueryData` → `fetchAvailability()`) would save ~0
  bytes and **lose** the warm-nav cache hit → **net-negative**. The app is already
  optimal on this axis. Issue #13 updated with this evidence.
