# Plan 012: Parse-once — request-scoped page/module cache (D-6)

> Renumbered 011 → 012 to avoid collision with the concurrent
> `plans/011-agent-discovery-implementation-loop.md` (a separate workstream).
>
> **Status: DONE** (approved + implemented + reviewer-verified, iteration 4 of the
> perf program, "optimise to the best", live-fetch target). Stamped at `bcfabcc`.
> Result: harness `bundle_live_fetches 5 → 1`; `AnchorResolver.resolve` contract
> unchanged; critic C2 (determinism) held. Increment over 008+009 = parse-once
> (server CPU) + cold/RAW-path fetch-once.

## Status
- **Priority**: P2 · **Effort**: M · **Risk**: MED · **Depends on**: 006, 008, 009
- **Category**: perf (resolving — live fetch + parse)
- **Issue**: follow-up to #12 (009 deferred D-6 here)

## Honest scope (read first — the win is narrower than "5 fetches → 1")

008 (single-flight) + 009 (parallel anchors) **already** collapse same-page
*concurrent* live fetches to **1** in the production path (`cachedResolutionContext`
wraps `ctx.fetch` in `withCache`; `withCache` also caches the JSON body, so the
`response.json()` parse is once too). What is **still O(N)** today:

- The **structural parse** — `parse(html)` (node-html-parser) for Confluence and
  the `split(/\r?\n/)` + per-line heading scan for Terraform — runs **inside each
  resolver call**, so N anchors on one page re-parse the full body N times. Pure
  **server (Lambda) CPU**, invisible to the cache layer.
- On the **RAW / cold-cache path** (no `withCache`, or a cold instance), the fetch
  itself is still N.

So D-6's incremental win = **parse the page/module once per bundle** (CPU) +
**fetch-once even when the content cache is cold/bypassed** (defense-in-depth).
The 006 harness (RAW fetch, no `withCache`, to isolate the resolver loop) will show
it as `bundle_live_fetches: 5 → 1` and a new `page_parses: 5 → 1`.

## Mechanism — request-scoped memo, **no `AnchorResolver.resolve` contract change**

- Extend `ResolutionContext` (`context-layer/src/resolvers/resolverTypes.ts`) with
  an **optional** request-scoped field:
  ```ts
  export type ResolutionContext = {
    token?: string;
    fetch: FetchLike;
    /** Request-scoped fetch+parse memo, keyed by resource URL. Created per bundle
     *  in buildContextBundle; never shared across requests/identities. */
    pageCache?: Map<string, Promise<unknown>>;
  };
  ```
  Optional → backward compatible (every existing caller/test still type-checks).
- `buildContextBundle` (`contextBundleService.ts`) creates a fresh `Map` per call
  and threads it into the `ctx` it passes to resolvers:
  `const bundleCtx = ctx.pageCache ? ctx : { ...ctx, pageCache: new Map() }`.
- `confluenceCloudContentProvider.ts`: extract `loadConfluencePage(ctx, config,
  pageId)` that memoizes **fetch + JSON + `parse(html)`** by pageId in
  `ctx.pageCache`, returning a parsed structure (e.g. `{ root, version, webui }`).
  `resolveConfluencePageLive` extracts its anchor's section from the cached `root`.
- `terraformModuleContentProvider.ts`: memoize `fetchRegistryModule` by module
  address in `ctx.pageCache` (the README anchor + every `module-field` anchor on a
  module share **one** registry fetch + parse).
- Offline path (`resolveAnchor`, pilot content map) is untouched — it does no fetch.

## Determinism (critic C2) — the gate
- Output must be **byte-identical** for a fixed seed: `contextBundleService.test.ts`
  passes with **zero edits**. Same sections extracted, just computed once.

## Security
- `pageCache` is created **inside** `buildContextBundle` (per request) and used only
  for that bundle's resolves, all under the **one** caller identity in `ctx`. It
  cannot leak content across identities (unlike the auth-keyed module-level
  `withCache`). Per-request lifetime → no cross-request bleed, no eviction policy
  needed.

## Steps
1. `resolverTypes.ts`: add the optional `pageCache` field. Verify typecheck.
2. `confluenceCloudContentProvider.ts`: `loadConfluencePage` memo (fetch+parse once);
   `resolveConfluencePageLive` reads the cached parse. Existing confluence tests pass.
3. `terraformModuleContentProvider.ts`: memo `fetchRegistryModule` by address.
   Existing terraform tests pass.
4. `contextBundleService.ts`: create + thread the per-request `pageCache`.
5. Extend the 006 harness with a `page_parses` counter (a parse spy) and confirm
   `bundle_live_fetches 5→1`, `page_parses 5→1`; production withCache path fetch
   already 1. Re-run determinism + full suite.

## Done criteria
- [ ] Harness: `bundle_live_fetches 5→1` and `page_parses 5→1` (new counter).
- [ ] `contextBundleService.test.ts` byte-untouched and passing (C2 determinism).
- [ ] Confluence + Terraform resolver tests pass unchanged.
- [ ] `pnpm test` + `pnpm typecheck` green (context-layer).
- [ ] `AnchorResolver.resolve` signature unchanged; offline path unchanged.

## STOP conditions
- Determinism test expectation would change → ordering/extraction drifted; revert.
- Threading `pageCache` would require changing `AnchorResolver.resolve` → reconsider.
- Parsed-structure memo can't preserve the exact section text → ship fetch-memo only.
