import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge } from "./helpers";

/**
 * D7 / D8 — the Portal home (`/`) becomes the APP home (I6): the situation card
 * (the Step-3 APP / landing-zone selector state), a "my changes" scoped
 * change-feed slice (embedding the Step-2 derived feed — the slice Step 2
 * anticipated, P31: NOT the editorial What's New), and the moment entries linking
 * `/briefs/adopt`, `/briefs/build`, `/briefs/change` (debug marked
 * not-yet-available). The catalog-first home is gone (I6's rejected alternative)
 * and the catalog demotes to a nav-reachable tool page — but the `/catalog`
 * route itself is kept, so a revert is route-level (D8).
 *
 * FROZEN CONTRACT for Batch 4 (the APP-home recomposition does not exist yet —
 * this spec is authored with the rest of the suite and EXCLUDED from the Batch-0
 * red loop, since there is no dev server there). Batch 4 must satisfy these
 * accessible hooks on deterministic mock data (`DEV_MOCKS=1`):
 *
 *   - the home renders the SAME "App / landing zone" selector as availability
 *     (the situation card), NOT a catalog grid as its primary content;
 *   - a scoped change-feed slice renders (honest-empty when the feed is empty —
 *     never fabricated), driven by that same selector;
 *   - moment entries link `/briefs/adopt`, `/briefs/build`, `/briefs/change`;
 *   - the catalog is still reachable via nav and `/catalog` still routes;
 *   - What's New (`/whatsnew`) stays a separate editorial surface (P31).
 *
 * All data is fictional (public-safe).
 */

test("the home is the APP home: situation card + change-feed slice + moment entries", async ({
  page,
}) => {
  await page.goto("/");
  await expectShellWithMockBadge(page);
  await page.waitForLoadState("networkidle");

  // Situation card: the SAME APP / landing-zone selector as availability/changes.
  await expect(page.getByRole("button", { name: /app \/ landing zone/i })).toBeVisible();

  // Moment entries: the three live moments link their brief pages.
  await expect(page.locator('a[href="/briefs/adopt"]')).toBeVisible();
  await expect(page.locator('a[href="/briefs/build"]')).toBeVisible();
  await expect(page.locator('a[href="/briefs/change"]')).toBeVisible();

  // The scoped change-feed slice renders as part of the home (the derived feed,
  // honest-empty when there are no events — never fabricated).
  await expect(page.getByRole("heading", { name: /changes/i })).toBeVisible();
});

test("the catalog is demoted to a nav-reachable tool page, and /catalog still routes (D8)", async ({
  page,
}) => {
  await page.goto("/");
  await expectShellWithMockBadge(page);
  await page.waitForLoadState("networkidle");

  // The catalog is reachable from nav (demoted, not deleted)...
  await page.locator('a[href="/catalog"]').first().click();
  await page.waitForLoadState("networkidle");

  // ...and the route still resolves to the catalog surface (revert is route-level).
  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByRole("heading", { name: /catalog/i })).toBeVisible();
});

test("What's New stays a separate editorial surface (P31)", async ({ page }) => {
  await page.goto("/whatsnew");
  await expectShellWithMockBadge(page);
  await page.waitForLoadState("networkidle");

  // The editorial newsletter still renders on its own route, unmerged with the
  // home's derived change-feed slice.
  await expect(page.getByRole("heading", { name: /what.?s new/i })).toBeVisible();
});
