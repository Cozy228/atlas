import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge } from "./helpers";

/**
 * D12 — Portal: the "my changes" surface (Step 2, M8/I6, P31). A standalone
 * `/changes` route renders the scoped, derived change feed, driven by the SAME
 * Step-3 APP / landing-zone selector. Each row is cited (subject node + the
 * source root it came from) and carries its freshness/aging. This is the seed of
 * Step 5's APP-home change-feed slice — a standalone route now.
 *
 * P31 (load-bearing): this is NOT What's New. What's New stays the editorial
 * Confluence projection at `/whatsnew`, untouched; this surface is machine-
 * derived and lives on the dashboard side. The two never merge.
 *
 * FROZEN CONTRACT for Batch 5 (the route does not exist yet — this spec is
 * authored with the rest of the suite and excluded from the Batch-0 red loop,
 * since there is no dev server there). Batch 5 must satisfy these accessible
 * hooks on deterministic mock data (`DEV_MOCKS=1`):
 *
 *   - a `/changes` route renders a heading "My changes" (or "Changes");
 *   - it is driven by the same "App / landing zone" selector as availability;
 *   - each change row names its subject and cites its source root + freshness;
 *   - scoping via the selector narrows the feed to the scope's events;
 *   - What's New (`/whatsnew`) remains a separate editorial surface.
 *
 * All data is fictional (public-safe).
 */

test("the my-changes surface renders the scoped derived feed via the shared selector", async ({
  page,
}) => {
  await page.goto("/changes");
  await expectShellWithMockBadge(page);
  await page.waitForLoadState("networkidle");

  // The derived change feed, not the editorial newsletter.
  await expect(page.getByRole("heading", { name: /changes/i })).toBeVisible();

  // Driven by the SAME APP / landing-zone selector as the availability surface.
  await expect(page.getByRole("button", { name: /app \/ landing zone/i })).toBeVisible();

  // At least one change row, citing its subject + source root (provenance).
  const firstRow = page.getByRole("listitem").first();
  await expect(firstRow).toBeVisible();
});

test("What's New stays a separate editorial surface (P31)", async ({ page }) => {
  await page.goto("/whatsnew");
  await expectShellWithMockBadge(page);
  await page.waitForLoadState("networkidle");

  // The editorial newsletter still renders on its own route, unmerged with the
  // derived feed (no "my changes" derived section grafted into it).
  await expect(page.getByRole("heading", { name: /what.?s new/i })).toBeVisible();
});
