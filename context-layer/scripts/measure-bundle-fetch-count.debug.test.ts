/**
 * PERF BASELINE harness (plan 006, Step 3 — Section 3 of perf-baseline.md).
 *
 * This is a measurement instrument, NOT a CI gate. It is a `*.debug.test.ts`,
 * excluded from `pnpm test` by the `--exclude "scripts/*.debug.test.ts"` glob in
 * context-layer/package.json. It records three live-round-trip baselines that
 * plans 008 (single-flight + negative cache) and 009 (batch-by-page) must move:
 *
 *   1. Bundle live-fetch count — `ctx.fetch` calls for a K-same-page-anchor
 *      `confluence-page` source at disclosure_level 2, with a RAW counting fetch
 *      (no withCache). Sequential anchor loop + no coalescing → expect K.
 *   2. Single-flight baseline (critic C1) — K concurrent withCache calls for the
 *      SAME url+headers. No single-flight today → thundering herd → expect K.
 *   3. Negative-cache baseline — two sequential withCache calls over a 404. 404s
 *      are not cached today → expect 2.
 *
 * Assertions are loose (a number is non-zero / matches today's behaviour); the
 * point is the printed `=== PERF BASELINE ===` line, not a brittle gate.
 */
import { describe, expect, it } from "vitest";

import {
  buildContextBundle,
  createDefaultContextBundleService,
} from "../src/services/contextBundleService";
import { InMemoryContentCache, withCache } from "../src/sourceContent/sourceContentCache";
import type { FetchLike, ResolutionContext } from "../src/resolvers/resolverTypes";

// A `confluence-page` source already present in the registry seed (data/sources.yaml).
// It is `visibility: internal` and not stale at `service.now`, so the only I/O the
// bundle performs is the live Confluence fetch we are counting.
const CONFLUENCE_SOURCE_ID = "central-lz-confluence";
// K distinct heading slugs we register as anchors on the SAME page. Each one
// resolves through the disclosure-2 anchor loop and triggers one `ctx.fetch`.
const SECTION_LOCATORS = ["section-one", "section-two", "section-three", "section-four"] as const;
const ANCHOR_COUNT = SECTION_LOCATORS.length;

// Confluence v2 storage HTML whose headings slugify to the locators above
// (slugify lowercases + replaces non-alphanumerics with `-`), so every anchor
// resolves to a non-empty excerpt and the live path is exercised end to end.
const STORAGE_HTML = [
  "<h2>Section One</h2><p>Alpha body.</p>",
  "<h2>Section Two</h2><p>Beta body.</p>",
  "<h2>Section Three</h2><p>Gamma body.</p>",
  "<h2>Section Four</h2><p>Delta body.</p>",
].join("");

const SIMULATED_LATENCY_MS = 20;

/** A canned Confluence v2 storage response, shaped like the live API. */
function confluenceStorageResponse(): { ok: true; status: number; json: () => Promise<unknown> } {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      title: "P",
      version: { number: 1 },
      body: { storage: { value: STORAGE_HTML } },
      _links: { webui: "/wiki/x" },
    }),
  };
}

/** Register K anchors with distinct heading-slug locators on the seed source. */
function seedSamePageAnchors(service: ReturnType<typeof createDefaultContextBundleService>): void {
  SECTION_LOCATORS.forEach((locator, index) => {
    service.registry.anchors.put({
      id: `${CONFLUENCE_SOURCE_ID}-${locator}`,
      source_id: CONFLUENCE_SOURCE_ID,
      anchor_strategy: "confluence-section",
      title: `Section ${index + 1}`,
      selector: { locator },
      citation_label: `${CONFLUENCE_SOURCE_ID}#${locator}`,
      status: "valid",
      last_validated_at: "2026-05-06T00:00:00.000Z",
    });
  });
}

describe("PERF BASELINE — live external round-trips", () => {
  it("records bundle live-fetch count, single-flight, and negative-cache baselines", async () => {
    // The live Confluence path only runs when a token AND base URL are set;
    // otherwise the resolver defers to the offline pilot map and never calls
    // ctx.fetch. Bearer auth (no email) keeps the canned response simple.
    process.env.CONFLUENCE_BASE_URL = "https://example.atlassian.net";
    delete process.env.CONFLUENCE_EMAIL;

    // ---- Baseline 1: bundle live-fetch count (raw counting fetch, no cache) ----
    const service = createDefaultContextBundleService();
    seedSamePageAnchors(service);

    // The TRUE anchor count drives the disclosure-2 loop: the K we register PLUS
    // any anchor the seed already carries for this source. Read it from the
    // registry so the baseline is the real fetch÷anchor ratio, not an assumption.
    const anchorCount = service.registry.anchors.findBySourceId(CONFLUENCE_SOURCE_ID).length;
    expect(anchorCount).toBeGreaterThanOrEqual(ANCHOR_COUNT);

    let bundleFetches = 0;
    const countingFetch: FetchLike = async (url) => {
      bundleFetches += 1;
      expect(url).toContain("/wiki/api/v2/pages/");
      expect(url).toContain("body-format=storage");
      await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
      return confluenceStorageResponse();
    };
    const ctx: ResolutionContext = { token: "test-token", fetch: countingFetch };

    // Wall-time of the disclosure-2 resolve loop. Each anchor's fetch sleeps
    // SIMULATED_LATENCY_MS. Today the loop is sequential `await`-in-loop, so wall
    // time ≈ anchorCount × latency. Plan 009 resolves anchors concurrently, so it
    // collapses to ≈ max(latency) ≈ one latency. This is 009's headline win
    // (latency Σ → max); the RAW fetch COUNT is unchanged by 009 (only D-6
    // batch-by-page, a deferred follow-up, reduces the count).
    const resolveStart = performance.now();
    const bundle = await buildContextBundle(
      service,
      { source_id: CONFLUENCE_SOURCE_ID, disclosure_level: 2 },
      ctx,
    );
    const bundleResolveWallMs = Math.round(performance.now() - resolveStart);

    const bundleSource = bundle.sources.find((entry) => entry.source.id === CONFLUENCE_SOURCE_ID);
    const excerptCount = bundleSource?.excerpts.length ?? 0;

    // Path exercised end to end: our K same-page anchors each resolved to a
    // non-empty excerpt (the lone seed anchor's locator does not match a heading
    // in the canned HTML, so it warns instead of yielding an excerpt — but it
    // STILL costs a fetch, which is exactly the per-anchor I/O 009 must batch).
    expect(excerptCount).toBe(ANCHOR_COUNT);
    expect(bundleSource?.excerpts.every((excerpt) => excerpt.text.length > 0)).toBe(true);
    // Iteration-stable bound: today (RAW fetch, no page memo) one fetch per
    // registered anchor → anchorCount; after D-6 (request-scoped page cache) all
    // same-page anchors share ONE fetch+parse → 1. The PRINTED number is the
    // metric; assert only the [1, anchorCount] envelope so re-runs stay green.
    expect(bundleFetches).toBeGreaterThanOrEqual(1);
    expect(bundleFetches).toBeLessThanOrEqual(anchorCount);
    // Sanity only (holds before AND after 009): at least one fetch's latency was
    // paid. The seriality story lives in the PRINTED wall-ms (≈ anchors×latency
    // today, ≈ one latency after 009), not in a brittle assertion.
    expect(bundleResolveWallMs).toBeGreaterThanOrEqual(SIMULATED_LATENCY_MS);

    // ---- Baseline 2: single-flight (critic C1) — K concurrent same-key calls ----
    const SINGLEFLIGHT_CONCURRENCY = 5;
    const sameUrl = "https://example.atlassian.net/wiki/api/v2/pages/123?body-format=storage";
    const sameInit = { method: "GET", headers: { Authorization: "Bearer test-token" } } as const;

    let singleFlightUnderlying = 0;
    const slowCountingFetch: FetchLike = async () => {
      singleFlightUnderlying += 1;
      await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
      return confluenceStorageResponse();
    };
    const cachedFetch = withCache(slowCountingFetch, new InMemoryContentCache(), 60);
    await Promise.all(
      Array.from({ length: SINGLEFLIGHT_CONCURRENCY }, () => cachedFetch(sameUrl, sameInit)),
    );
    // Iteration-stable bound: today (no single-flight) every concurrent call
    // misses the not-yet-set cache → herd = K; after 008 single-flight → 1. The
    // PRINTED number is the metric; assert only the [1, K] envelope so re-runs
    // across iterations stay green.
    expect(singleFlightUnderlying).toBeGreaterThanOrEqual(1);
    expect(singleFlightUnderlying).toBeLessThanOrEqual(SINGLEFLIGHT_CONCURRENCY);

    // ---- Baseline 3: negative cache — two sequential 404s through withCache ----
    let negativeUnderlying = 0;
    const notFoundFetch: FetchLike = async () => {
      negativeUnderlying += 1;
      return { ok: false, status: 404, json: async () => ({}) };
    };
    const cachedNotFound = withCache(notFoundFetch, new InMemoryContentCache(), 60);
    const missUrl = "https://example.atlassian.net/wiki/api/v2/pages/404?body-format=storage";
    await cachedNotFound(missUrl, sameInit);
    await cachedNotFound(missUrl, sameInit);
    // Iteration-stable bound: today (no negative cache) the 404 re-fetches → 2;
    // after 008 negative cache → 1. Assert only [1, 2]; the printed value is the metric.
    expect(negativeUnderlying).toBeGreaterThanOrEqual(1);
    expect(negativeUnderlying).toBeLessThanOrEqual(2);

    console.log(
      `=== PERF BASELINE === bundle_live_fetches=${bundleFetches} anchors=${anchorCount} ` +
        `excerpts=${excerptCount} bundle_resolve_wall_ms=${bundleResolveWallMs} ` +
        `| singleflight_concurrent${SINGLEFLIGHT_CONCURRENCY}=${singleFlightUnderlying} ` +
        `| negative_2x404=${negativeUnderlying}`,
    );
    console.log(
      `[PERF-bundle] source=${CONFLUENCE_SOURCE_ID} disclosure_level=2 ` +
        `registered_anchors=${anchorCount} (seeded_same_page=${ANCHOR_COUNT}) ` +
        `fetches_per_anchor=${(bundleFetches / anchorCount).toFixed(2)} ` +
        `resolve_wall_ms=${bundleResolveWallMs} (seq≈anchors×${SIMULATED_LATENCY_MS}ms; 009 parallel→≈${SIMULATED_LATENCY_MS}ms)`,
    );
  });
});
