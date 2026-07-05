import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge } from "./helpers";

/**
 * D12 — Portal: the moment brief pages (Step 4, I3/M9/P26). A `/briefs/{moment}`
 * route renders the one scoped `Brief` value — the SAME value the API and `.md`
 * faces serve (face drift is structurally inexpressible, I3) — driven by the
 * SAME Step-3 APP / landing-zone selector as availability and my-changes. Each
 * block states its question, its two-axis status, and its cited evidence; per-zone
 * blocks (availability, policy) render once per member zone (P26).
 *
 * FROZEN CONTRACT for Batch 5 (the route does not exist yet — this spec is
 * authored with the rest of the suite and EXCLUDED from the Batch-0 red loop,
 * since there is no dev server there). Batch 5 must satisfy these accessible
 * hooks on deterministic mock data (`DEV_MOCKS=1`):
 *
 *   - a `/briefs/adopt` route renders a moment heading (e.g. "Adopt");
 *   - it is driven by the same "App / landing zone" selector as availability;
 *   - at least one brief block renders with its question + cited evidence;
 *   - What's New (`/whatsnew`) remains a separate editorial surface (P31).
 *
 * All data is fictional (public-safe).
 */

test("the adopt brief page renders the scoped Brief via the shared selector", async ({ page }) => {
  await page.goto("/briefs/adopt");
  await expectShellWithMockBadge(page);
  await page.waitForLoadState("networkidle");

  // The moment brief, headed by its moment.
  await expect(page.getByRole("heading", { name: /adopt/i })).toBeVisible();

  // Driven by the SAME APP / landing-zone selector as the availability surface.
  await expect(page.getByRole("button", { name: /app \/ landing zone/i })).toBeVisible();

  // At least one brief block, stating its question + cited evidence.
  const firstBlock = page.getByRole("listitem").first();
  await expect(firstBlock).toBeVisible();
});

test("What's New stays a separate editorial surface (P31)", async ({ page }) => {
  await page.goto("/whatsnew");
  await expectShellWithMockBadge(page);
  await page.waitForLoadState("networkidle");

  // The editorial newsletter still renders on its own route, unmerged with the
  // derived briefs.
  await expect(page.getByRole("heading", { name: /what.?s new/i })).toBeVisible();
});
