import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge } from "./helpers";

/**
 * Degraded / honest-gap states (plan 026 WU8). The app must show a loading
 * skeleton, an honest-empty surface, and a graceful route error — never a
 * white screen or fabricated content (ADR-0006).
 */
test.describe("degraded states (mock-forced)", () => {
  // Deferred loading: the skeleton is observable (DEV_MOCK_LATENCY_MS widens the
  // window), then it resolves to the real matrix.
  test("availability shows a loading skeleton, then the matrix resolves", async ({ page }) => {
    await page.goto("/availability", { waitUntil: "commit" });
    await expect(page.getByLabel(/Loading (service )?availability/i)).toBeVisible();
    await expect(page.getByRole("table").first()).toBeVisible();
  });

  // Honest-empty: the mock What's New feed has no updates — assert the empty
  // state renders with NO fabricated release links, and the page does not crash.
  test("whatsnew renders an honest-empty state, no fabricated releases", async ({ page }) => {
    await page.goto("/whatsnew");
    await expectShellWithMockBadge(page);
    await expect(page.locator('a[href^="/releases/"]')).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /what.s new/i }).first()).toBeVisible();
  });

  // Route error boundary: a not-found dynamic slug renders a graceful, status-aware
  // error page INSIDE the shell — never a white screen.
  test("a bogus service slug renders a graceful error, not a white screen", async ({ page }) => {
    await page.goto("/service/aws/__no-such-service__");
    await expect(page.locator("header").first()).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: /can.t show|couldn.t reach|hit an error|could not resolve/i,
      }),
    ).toBeVisible();
  });
});
