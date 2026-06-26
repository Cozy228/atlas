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

### Iteration 7 — plan 013 Phase 1 (matrix client-render) ✅ landed + re-perf'd
Implemented the P0/P1 fixes and re-ran the **same** harness (raw-CDP CPU 6×+Slow-4G;
`agent-browser` React profiler) on this machine. **Headline: the throttled main-thread
cost of the availability matrix is essentially eliminated.**

| Client-render metric (throttled, same harness) | before | after |
|---|---|---|
| `/availability` cold **TBT** (long-tasks) | **446 ms** | **0 ms** ✅ |
| tab-switch `/`→`/availability` main-thread **freeze** | **189 ms / 1 task** | **0 ms / 0 tasks** ✅ |
| tab-switch time-to-matrix | 599 ms | 561 ms ✅ |
| `/`→`/availability` **mounts** | **76,667** | **6,215 (−92%)** ✅ |
| `/`→`/availability` re-renders | 33,837 | 630 ✅ |
| FPS min / drops during nav | **3 / 3** | **40 / 0** ✅ |
| single service-select: `ChevronDown` re-renders | **×3782** | **×1** ✅ |
| single service-select: matrix `<table>` DOM | (re-render storm) | **NOT remounted (CDP node-identity verified)** ✅ |

What landed (v8, no new deps): **P0-1** defer the matrix mount one paint past the
shell (`useState` + double-`rAF` + `startTransition`, `MatrixSkeleton` placeholder)
so the cold nav commit is no longer one long task; **P0-2** collapse the icon
triple-mount — drop the per-icon `requestIdleCallback` gate in `MappedServiceIcon`
(render the real SVG directly) and preload the active pack at the **route loader**
so the lazy module is resolved before the deferred matrix mounts (1 mount/icon);
**P0-3** static `columns` — selection out of the column defs (chevron is now pure
CSS `group-data-[selected=true]:`), `selectedServiceId` dropped from the route's
`rowModel` memo (it only fed an unused `selectedRow`), location-toggle moved into
the reducer, and each row split into a `MatrixRow`; **P1-4** `<link rel=preload
as=font>` for `inter-latin-wght-normal.woff2`; **P2** `StickyAside` RO→`setState`
batched in `rAF`.

**[❌ SUPERSEDED — see Iteration 9: this whole "compiler is OFF" finding was a VERIFICATION
ERROR. The React Compiler IS running; the manual memo below was redundant and has been removed.
Kept here only to show the (flawed) diagnostic path.]**

**⚠️ Critical correction to Iteration 6's "React Compiler is ON":** it is **NOT**.
Verified empirically — **zero** chunks import `react/compiler-runtime`, `useMemoCache`
count is 0, and callbacks compile to raw inline arrows (`onSelect:e=>n({type:…})`).
Root cause: `vite.config.ts` does `babel({ presets: [reactCompilerPreset()] })`, but
`reactCompilerPreset()` returns a `{ preset, rolldown }` **wrapper object**, not a Babel
preset, so `presets:` silently no-ops. A retry with the plugin applied directly
(`plugins: [["babel-plugin-react-compiler", { target: "19" }]]`) **also** produced 0
compiler-runtime imports → the `@vitejs/plugin-react` v6 ⇄ Vite-8-Rolldown ⇄
`@rolldown/plugin-babel` integration needs the rolldown-specific
`applyToEnvironmentHook`/`filter` from `reactCompilerPreset().rolldown` wired in (a
separate, app-wide build-tooling fix — not attempted under 013's matrix scope).
**Consequence:** the plan's "compiler handles memoisation → no manual memo" premise is
false, so meeting DoD item 3 required a **scoped, documented exception**: `useCallback`
on the two matrix handlers (so `columns` stays static — otherwise every cell REMOUNTS
on select) + `React.memo(MatrixRow)` (so only the toggled rows re-render). These are
labelled in-code as "remove once the compiler is wired" and revert cleanly.

Honest notes: **(a)** `agent-browser`'s headless **rAF throttling** delays the
deferred (P0-1) mount into whatever window next activates the page, inflating raw
"mount" counts — so the no-remount claim is proven by a **raw-CDP DOM-identity check**
(`remount-check.mjs`: tag the `<table>`/row nodes, click a row, confirm `===` identity
+ dataset tags survive) rather than the profiler's mount column. **(b)** **P1-4 font
preload — A/B resolved: FCP-neutral, KEPT.** The earlier 3024 ms was a single cold-cache
outlier; 3 fresh-browser cold samples WITH the preload read **2740 / 2688 / 2704 ms
(≈ baseline 2724)** — the preload does **not** move `/` cold FCP, exactly as
`font-display: swap` predicts (fallback paints at FCP; the brand font is off the critical
path), and doesn't measurably hurt it either (entry JS/CSS dominates the ~2.7 s). Its only
effect is faster brand-font swap-in at no measured FCP cost → kept. The DoD's "`/` FCP
improved via font preload" was **misframed**: FCP is unchanged; the real first-paint lever
is the entry chunk (A-1, iter 5). Behavior preservation CDP-verified too: map↔matrix toggle,
service select + expand, region/column highlight, sticky aside (`position:sticky` at 1440px),
real icons **61/61 (zero monogram fallbacks)**. Verify:
lint 0, `pnpm build` 0, 5-route serve smoke all **200**. Portal suite ended **116/116
passed** — mid-run it briefly showed one `openapiDocument` parity failure from the
**concurrent plan-011 agent-discovery loop** editing `context-layer`'s `GET /resources`
dispatch on the shared tree; that loop then documented the route and the suite went
fully green (the 8 extra tests vs 013's start are plan-011's, not ours).
**Pending:** Phase 2 v9/Virtual spikes (worktree), P1-5 View Transitions, the P1-4 A/B.

### Iteration 8 — plan 013 Phase 2 spikes (TanStack Virtual + Table v9) ✅ evaluated
Isolated worktree `atlas-p013-wt` (HEAD `1c37151` + Phase-1 files, builds clean). Full
results + verdicts in **`plans/013` → "Phase 2 实测结果"**. Summary:
- **Virtual (3.14.3, stable) — real integration + measured, NOT worth it.** `useWindowVirtualizer`
  windowing cut realized rows **61→18 (−70%)** and matrix DOM nodes **1393→392 (−72%)**, but
  throttled `/availability` TBT (**0→0 ms**) and tab-switch blocking (**0→0 ms**, t-t-matrix
  561→561) **did not move** — Phase-1 v8 (defer-mount + `content-visibility` + static columns) is
  already at the 0 ms floor, so windowing buys no measurable UX gain for ≤61 rows, at the cost of
  dropping the semantic `<table>`/react-table/motion-expand/domain-groups/sticky-`<thead>` + the
  locked tests. **DOM ≠ UX once the main thread is already idle.**
- **Table v9 (9.0.0-beta.19, beta) — feasibility + friction assessed, do NOT adopt now.** Verified
  it installs/coexists in this Vite-8-Rolldown/Start/React-19 stack and exposes the full idiomatic
  API (`useTable(opts, selector)`, `tableFeatures`/`coreFeatures`, `flexRender`/`<FlexRender/>`,
  `<Subscribe selector>`). Concrete friction (from real `.d.ts` signatures): v9's Subscribe isolates
  **table state**, but the matrix's selection is a **route-reducer prop** → adopting it means
  relocating selection into v9 `rowSelection` (inverting route→table flow), on a **beta** dep, for a
  result **v8 already delivers**. Full migration+measurement intentionally not done (verdict is
  predetermined: v9's Subscribe is **redundant** with stable v8 + the **working React Compiler**, which
  already gives the same memo-free idiomatic selection isolation app-wide — see Iteration 9; the
  earlier "repair the compiler" framing was based on the now-corrected false negative). Tracked for
  when v9 is stable.

### Iteration 9 — React Compiler "off" was a verification error; manual memo removed ✅
**Correction to Iterations 7–8.** The claim that the React Compiler "is NOT running" was **wrong**.
The compiler runs fine on the **official** config `babel({ presets: [reactCompilerPreset()] })`
(React 19, no `target`) — the config never needed changing (the final `vite.config.ts` diff is
comment-only).

Why the earlier check was a **false negative**: (1) client chunks are **minified** (the compiler's
`react/compiler-runtime` `c` import becomes a single-letter local), and (2) Rolldown **inlines**
`react/compiler-runtime` into the shared `react-*` chunk — so `grep`-ing individual client chunks for
the literal string returns 0 even though the compiler ran. (The `useMemoCache` grep was also wrong —
that's the React-18.3 name; React 19 uses `c` from `react/compiler-runtime`.) Reliable signals: the
**server bundle** `.output/server/_ssr/availability.index-*.mjs` **does** import
`react/compiler-runtime`; and behaviourally — after **removing all the manual memo** (the
`useCallback`s + `React.memo(MatrixRow)` I had added under the wrong premise) — a single service-select
**still** does NOT remount the matrix (CDP node-identity: `sameTableRef` + dataset tags survive) and
the profiler shows **cell/qt/Lt/icon re-renders = 0, `ChevronDown` ×1**. So the compiler memoises the
route callbacks (→ static `columns`) and `MatrixRow` (per-row) on its own; the manual memo was
redundant. (The "1371 mounts" the profiler shows on select is the known agent-browser rAF-throttling
artifact — the deferred P0-1 mount firing in-window — not a real remount, per the CDP check.)
**Action:** reverted `availability.index.tsx` to inline dispatch handlers, unwrapped `MatrixRow`,
restored `vite.config.ts` to the official preset. Re-verified: lint 0, test **116/116**, build 0,
5-route smoke 200, matrix select CDP-clean. **Net: the matrix meets DoD item 3 with zero manual memo**
— honouring the plan's "compiler handles memoisation" constraint. Iter 7–8's "fix the compiler /
v9-is-higher-leverage" framing is moot (nothing to fix; v9's Subscribe is redundant with working v8 +
compiler). Lesson: verify compiler output via the **server bundle** or a behavioural/CDP test, never a
literal grep of minified, runtime-inlined client chunks.

**Definitive compiler proof (user-requested, `build.minify:false` + grep):** the unminified client
matrix chunk contains **43 × `Symbol.for("react.memo_cache_sentinel")`** cache-slot checks — the React
Compiler's signature pattern (`const $ = _c(N); if ($[k] === <sentinel>) { $[k] = … }`). (That
`memo_cache_sentinel` string in fact survives minification too — the correct grep token all along; my
original `react/compiler-runtime` / `useMemoCache` / `_c(` patterns were just wrong.) Compiler status
is now beyond doubt; `vite.config.ts` `minify:false` reverted.

**P1-5 View Transitions — measured + REJECTED (not deferred).** Enabling `defaultViewTransition: true`
re-adds **~158 ms** of main-thread blocking to the throttled `/`→`/availability` switch (warm,
reproduced two runs; **0 ms** without it), and a longer freeze on the cold first nav — the snapshot
capture + cross-fade on a CPU-6× device, even with the matrix mount deferred (P0-1). It undoes this
plan's headline tab-switch win, so it stays **off** on the slow-device lens. Reverted; `router.tsx`
documents the rationale inline. (Visual cross-fade quality is moot if it costs the perf win.)

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
