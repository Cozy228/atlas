import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge, SAMPLE_SERVICE_PATH } from "./helpers";

/**
 * Mobile narrow-viewport pass (plan 026 WU6 + WU9). A 375px viewport across every
 * top-level page plus a service detail: nothing overflows horizontally, and the
 * hamburger nav (which replaces the desktop bar below md) opens and navigates.
 * /overview and /skills are omitted — both redirect to home (gated).
 */
test.use({ viewport: { width: 375, height: 812 } });

const MOBILE_ROUTES = [
  "/",
  "/availability",
  "/catalog",
  "/guidance",
  "/sources",
  "/whatsnew",
  "/support",
  SAMPLE_SERVICE_PATH,
] as const;

test.describe("mobile (375px)", () => {
  for (const path of MOBILE_ROUTES) {
    test(`no horizontal overflow on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expectShellWithMockBadge(page);
      const overflowPx = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflowPx, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1); // 1px rounding slack
    });
  }

  test("hamburger nav opens and navigates", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle"); // let the menu button hydrate before clicking
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await drawer.getByRole("link", { name: "Catalog" }).click();
    await expect(page).toHaveURL(/\/catalog/);
  });
});
