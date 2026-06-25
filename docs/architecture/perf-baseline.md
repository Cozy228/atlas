# Performance baseline (plan 006)

> **What this is.** The objective, repeatable "before" numbers the performance
> program (plans 007–010) proves its wins against. Each later plan claims a win in
> wire bytes, external round-trips, or main-thread ms — those claims are only
> provable against numbers captured the same way before and after. Re-run the
> harnesses below after 008/009 and diff; the delta is the proof.
>
> **Captured at** commit `bcfabcc` (branch `codex/MVP-source-loop`), 2026-06-26,
> Node v22.22.2, vite 8.1.0. Chunk hashes are content-derived and rotate across
> builds — re-run the harness and update the table when they change.
>
> **How to re-capture (all commands):**
>
> | Section | Command | From |
> |---|---|---|
> | 1. Bundle inventory | `pnpm build && node scripts/print-chunk-sizes.mjs` | `portal/` |
> | 2. Render cost | `pnpm measure:availability-render` | `portal/` |
> | 3. External round-trips | `pnpm exec vitest run scripts/measure-bundle-fetch-count.debug.test.ts --reporter verbose` | `context-layer/` |
> | 4. Throttled trace | Chrome DevTools (manual — see §4) | served build |

---

## 1. Bundle inventory (commit `bcfabcc`)

Per-chunk wire sizes from `portal/.output/public/assets/`, produced by
`portal/scripts/print-chunk-sizes.mjs` (Node `zlib.gzipSync` / `brotliCompressSync`).
**gzip / brotli are what a slow link actually transfers** — roughly 30 % of the raw
(uncompressed) size for JS/CSS. The raw column is what `ls` reports and overstates
the wire cost ~3×.

`E` marks the **entry chunk** (always loaded). `R<route>` marks a chunk loaded
lazily by a route. Sizes in KB.

| Chunk | Loaded by | Raw | gzip | brotli |
|---|---|---:|---:|---:|
| `index-*.js` **(E)** | every page (entry) | 413.5 | **125.1** | 106.2 |
| `react-dom-*.js` | every page | 185.0 | 57.5 | 49.6 |
| `react-*.js` | every page | 0.9 | 0.4 | 0.4 |
| `globals-*.css` | every page | 129.7 | 21.3 | 17.1 |
| `aws-icons-*.js` | `/availability` (AWS), detail icons | 122.3 | 36.2 | 31.1 |
| `azure-icons-*.js` | `/availability` (Azure), detail icons | 118.8 | 28.6 | 23.7 |
| `availability.index-*.js` `R/availability` | `/availability` | 116.1 | 41.9 | 31.4 |
| `feedback-inline-form-*.js` | feedback surfaces | 79.7 | 21.9 | 19.4 |
| `motion-*.js` | animation (`framer`/`motion`) | 65.1 | 22.6 | 20.7 |
| `catalog.index-*.js` `R/catalog` | `/catalog` | 44.0 | 13.9 | 12.0 |
| `toggle-group-*.js` | shared UI | 39.0 | 14.1 | 12.3 |
| `overview-*.js` `R/overview` | `/overview` | 37.4 | 9.8 | 8.5 |
| `usePositioner-*.js` | masonry/positioning | 36.6 | 13.3 | 12.0 |
| `dist-*.js` | vendor | 31.8 | 8.9 | 7.9 |
| `guardrails._guardrailId-*.js` `R/guardrails/$id` | guardrail detail | 25.8 | 7.8 | 6.6 |
| `routes-*.js` | router shell | 22.3 | 7.1 | 6.1 |
| `catalog._topicId-*.js` `R/catalog/$topicId` | topic datasheet | 22.3 | 6.7 | 5.7 |
| `ask-atlas-chat-*.js` | Ask chat | 20.2 | 7.3 | 6.5 |
| `sources.index-*.js` `R/sources` | `/sources` | 17.8 | 6.5 | 5.6 |
| `tooltip-*.js` | shared UI | 16.6 | 6.2 | 5.6 |
| `ask-overlay-*.js` | Ask overlay | 15.8 | 5.5 | 4.8 |
| `sources._sourceId-*.js` `R/sources/$id` | source detail | 14.8 | 4.9 | 4.2 |
| `tabler-icons-*.js` | shared icons | 14.4 | 3.9 | 3.3 |
| `guidance.index-*.js` `R/guidance` | `/guidance` | 14.3 | 5.0 | 4.4 |
| `skills.index-*.js` `R/skills` | `/skills` | 13.8 | 4.6 | 3.9 |
| `whatsnew-*.js` | what's-new | 12.2 | 4.1 | 3.5 |
| `service-icon-*.js` | detail service icon | 5.2 | 2.3 | 2.0 |
| `azure-service-icon-*.js` | detail Azure icon | 1.6 | 0.9 | 0.8 |

(Long tail of < 12 KB shared/leaf chunks omitted; run the script for the full
list. 140 assets total emitted.)

### Fonts (Inter, `@fontsource-variable`)

woff2 is already compressed — gzip/brotli do not apply; the raw byte size **is**
the wire cost. Subsets are unicode-range-gated, so only the subset a page actually
needs is fetched.

| Subset | Wire (woff2) |
|---|---:|
| `inter-latin-wght-normal` (base — what a cold `/` needs) | **47.1 KB** |
| `inter-latin-ext-wght-normal` | 83.0 KB |
| `inter-cyrillic-wght-normal` | 18.3 KB |
| `inter-greek-wght-normal` | 18.5 KB |
| `inter-vietnamese-wght-normal` | 10.0 KB |
| (other unicode-range subsets) | — |

### Cold-`/` first-load total

What a fresh visit to `/` downloads before hydration (entry + react + react-dom +
globals.css + the inter-latin base subset):

| Component | gzip | brotli |
|---|---:|---:|
| `index-*.js` (entry) | 125.1 | 106.2 |
| `react-dom-*.js` | 57.5 | 49.6 |
| `react-*.js` | 0.4 | 0.4 |
| `globals-*.css` | 21.3 | 17.1 |
| **JS + CSS subtotal** | **204.4** | **173.3** |
| `inter-latin` woff2 (already compressed) | 47.1 | 47.1 |
| **Cold-`/` total over the wire** | **≈ 251.5 KB** | **≈ 220.4 KB** |

**Headline.** The entry chunk alone is **125 KB gzip (106 KB brotli)** of
parse+eval on the main thread before hydration — the single biggest first-paint JS
cost on `/` (audit finding A-1). Its composition is unverified; the A-1 follow-up
needs a source-map visualizer pass, then re-run this section and diff the entry
gzip. F-3′: the detail routes (`/catalog/$topicId`, `/sources/$sourceId`) render
**one** service icon but the icon packs (`aws-icons` 36 KB gzip, `azure-icons`
29 KB gzip) are separate chunks — confirm whether a datasheet actually pulls the
full pack vs. the small `service-icon-*` / `azure-service-icon-*` leaf chunks
during the F-3′ pass.

---

## 2. Availability render cost

`portal/scripts/measure-availability-render-cost.debug.test.tsx` (run via
`pnpm measure:availability-render`) `renderToString`s the dense availability
matrix 10× and reports median + max ms. Synthetic zones: **AWS = 27 services × 5
locations**, **Azure = 30 services × 10 locations** (the wider, denser grid).

| Surface | median | max |
|---|---:|---:|
| AWS `MatrixView` | **10.54 ms** | 28.88 ms |
| Azure `MatrixView` | **5.45 ms** | 7.33 ms |
| AWS status dots | 0.42 ms | 0.59 ms |
| AWS cards | 0.98 ms | 1.84 ms |
| Azure status dots | 0.91 ms | 3.31 ms |
| Azure cards | 1.07 ms | 2.29 ms |

> AWS measures slower than the larger Azure grid because run 1 absorbs JIT warm-up
> (max 28.9 ms vs. median 10.5 ms); the median is the stable figure. The harness
> does not report DOM-node count — node count is `regions × services`, and
> `portal/src/components/explore/matrix-view.tsx:196` applies
> `content-visibility:auto` (+ `contain-intrinsic-size`) so off-screen rows skip
> layout/paint. The numbers above are SSR string render only (no layout/paint), so
> they are a lower bound on the client cost; the throttled trace (§4) captures the
> on-device CPU cost.

---

## 3. External-resolver calls per bundle (live round-trips)

Harness: `context-layer/scripts/measure-bundle-fetch-count.debug.test.ts` — a
`*.debug.test.ts`, **excluded from CI** by the `--exclude "scripts/*.debug.test.ts"`
glob in `context-layer/package.json`. Each baseline counts the underlying
`ctx.fetch` (the only external I/O) and `console.log`s a labeled block.

> **Why it must drive the LIVE path.** `confluencePageResolver.resolve` only
> reaches `resolveConfluencePageLive` (which calls `ctx.fetch`) when a token AND
> `ATLAS_CONFLUENCE_BASE_URL` are set; otherwise it defers to the offline pilot map
> and never fetches (counter would read 0). The harness sets
> `ATLAS_CONFLUENCE_BASE_URL=https://example.atlassian.net` (no `ATLAS_CONFLUENCE_EMAIL`
> → Bearer auth) and passes `ctx = { token: "test-token", fetch: countingFetch }`,
> with a canned Confluence v2 storage response. Fixture source:
> `central-lz-confluence` (a `confluence-page` in `data/sources.yaml`), seeded with
> 4 same-page anchors whose locators slugify to headings in the canned HTML so
> every one resolves to a non-empty excerpt.

### Captured baseline line

```
=== PERF BASELINE === bundle_live_fetches=5 anchors=5 excerpts=4 bundle_resolve_wall_ms=108 | singleflight_concurrent5=5 | negative_2x404=2
[PERF-bundle] source=central-lz-confluence disclosure_level=2 registered_anchors=5 (seeded_same_page=4) fetches_per_anchor=1.00 resolve_wall_ms=108 (seq≈anchors×20ms; 009 parallel→≈20ms)
```

| Baseline | What it measures | Today | Why | Moved by |
|---|---|---:|---|---|
| **Bundle resolve wall-ms** | wall-time of the disclosure-2 resolve loop, 5 same-page anchors, 20 ms/fetch latency | **108 ms** | **Sequential `await`-in-loop** → latency = Σ(anchors) ≈ 5×20 ms | **009** (parallel anchors: Σ → **max** ≈ 20 ms) |
| **Single-flight (critic C1)** | 5 **concurrent** `withCache` calls for the SAME url + headers | **5** | No single-flight; every concurrent call misses the not-yet-populated cache → thundering herd | **008** (single-flight: 5 concurrent → 1 underlying) |
| **Negative cache** | 2 sequential `withCache` calls over a 404 | **2** | `withCache` caches only `ok` responses, so a 404 re-fetches every time | **008** (negative cache: 2 → 1) |
| **Bundle live-fetch count** | `ctx.fetch` calls per bundle, same-page anchors, RAW fetch (no `withCache`) | **5** (1.00/anchor) | One fetch per registered anchor, no page-level coalescing | **D-6** *(parse-once / batch-by-page — a deferred contract-changing follow-up, **NOT** plan 009's scope; 009 only parallelises, leaving the RAW count at 5)* |

> **Correction (reviewer):** plan 009 as scoped parallelises the resolve loop only;
> it does **not** batch by page, so the RAW `bundle_live_fetch` count stays 5 after
> 009 — what 009 moves is the **wall-time** (108 ms → ≈20 ms). Reducing the count
> itself (5 → 1 for a same-page source) requires D-6 (parse-once/batch-by-page),
> tracked as a follow-up. In the *production* live path (`cachedResolutionContext`
> wraps `ctx.fetch` in `withCache`), sequential same-page anchors already collapse
> to 1 live fetch via the cache — so 008's single-flight is what prevents 009's
> parallelism from reintroducing the herd (the critic C1 gate).
>
> Note on `anchors=5` vs. `excerpts=4`: `central-lz-confluence` already carries one
> seed anchor (`environment-matrix`) whose locator doesn't match a heading in the
> canned HTML → `broken_anchor` warning, no excerpt, but **still one fetch**.

---

## 4. Throttled trace methodology

> **Status: CAPTURED (2026-06-26).** Measured on a headless Chromium driven over
> **raw CDP** with `Emulation.setCPUThrottlingRate {rate: 6}` (low-spec Windows CPU
> proxy) + `Network.emulateNetworkConditions` (Slow-4G ≈ 400 Kbps / 400 ms RTT —
> the slow proxied corporate link). Client **re-render** counts captured separately
> via `agent-browser react renders` (onCommitFiberRoot). Scripts:
> `scratchpad/cdp-throttle-measure.mjs`, `cdp-tabswitch.mjs`.

**Why throttled.** The target machine is a low-spec Windows laptop on a slow
corporate link. The proxy for it is **Network = Slow 4G** + **CPU = 6× slowdown**
in the Chrome DevTools Performance/Network panels.

**Serve a production build** (not the dev server):

```
pnpm build && pnpm start   # from portal/ → node .output/server/index.mjs
```

**Routes to trace** (warm load, then SPA-navigate from `/`):

`/` · `/overview` · `/catalog` · `/availability` · `/catalog/aws-textract`
(a real topic datasheet) · `/ask` · `/guidance`

**Metrics per route:** TTFB, FCP, LCP, TBT, and SPA route-transition time (nav from
`/` to the route after a warm load). **3 runs per route; record median + p95.**

**Procedure:**
1. Serve the production build; open the route in an incognito window with cache
   disabled.
2. DevTools → Network: Slow 4G; Performance → CPU: 6× slowdown.
3. Reload 3×; read TTFB/FCP/LCP/TBT from the Performance panel (or
   `performance.getEntriesByType('navigation')` / web-vitals).
4. For SPA transition: warm-load `/`, then click through to the route and measure
   the navigation duration.

Cold load (CPU 6× + Slow-4G). TTFB is in-process (offline server); on a real
proxied link add the network RTT. FCP/LCP/TBT are what the user feels.

| Route | TTFB | FCP | LCP | TBT (long-tasks) | full load |
|---|---:|---:|---:|---:|---:|
| `/` | 21 ms | **2724 ms** | 2724 ms | **395 ms** (4) | 8011 ms |
| `/catalog` | 37 ms | 500 ms | 616 ms | 96 ms (1) | 2962 ms |
| `/availability` | 36 ms | 504 ms | 624 ms | **446 ms** (1) | 8376 ms |
| `/guidance` | 28 ms | 532 ms | 620 ms | 0 ms | 1364 ms |

(`/catalog`,`/availability`,`/guidance` measured after `/` warmed the shared chunks,
so their FCP is low; the standout is **TBT** — main-thread blocking from JS execution
under the 6× CPU. `/availability`'s 446 ms is the matrix mount.)

**SPA tab-switch (throttled), `/` → `/availability`:** time-to-matrix **599 ms**,
main-thread blocking **189 ms** in one long task — a perceptible freeze on tab-switch
even with chunks cached (the matrix reconciling ~20k fibers under 6× CPU).

**Client re-render profile (un-throttled, `agent-browser react renders`), `/` → `/availability`:**
110,504 renders (76,667 mounts + 33,837 re-renders) across 93 components in 1.77 s;
**FPS min 3, 3 drops <30 fps**. The availability matrix mounts **~20,000+ components**
(`content-visibility:auto` skips off-screen *layout* but not React mount/reconcile).
**Icon re-render churn**: `ChevronDown` ~3782×, another leaf icon ~3788× during the
single nav. → headline client-perf finding: **the matrix mount/render cost** (TBT 189–446 ms,
frame drops) is the top main-thread issue for the target machine; the icon churn and
theme-context fan-out are secondary.

**A-5 to confirm during this capture:** whether the server entry streams SSR
(TanStack Start streams by default) or buffers. If TTFB ≈ full-render time on slow
links, it is buffering; if first bytes arrive early, it is streaming. Inspect the
server handler and record the finding here.

---

## Deviations from plan 006

- **Step 3 / STOP condition (CI-exclusion):** plan 006 says to STOP if the
  `context-layer` `test` script does not already exclude `scripts/*.debug.test.*`.
  It did not (it was a bare `vitest run`, no vitest config). Per reviewer
  authorization, exactly **one** line in `context-layer/package.json` was changed —
  `"test": "vitest run"` → `"test": "vitest run --exclude \"scripts/*.debug.test.ts\""`
  — mirroring portal's existing `--exclude scripts/*.debug.test.tsx`. This NARROWS
  CI (keeps the debug harness out); no other source was touched. Verified:
  `pnpm test` (context-layer) passes and the debug file does **not** appear in its
  run.
- **Section 3 scope (expanded per reviewer):** beyond the single bundle fetch count
  the plan asked for, two additional live-round-trip baselines were recorded in the
  same debug file — single-flight (critic C1) and negative-cache — because plan 008
  reduces both and needs a "before" number. All three are in the one
  `=== PERF BASELINE ===` line.
