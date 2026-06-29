import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge } from "./helpers";

/**
 * Mobile assertion (plan 026 WU6). A 390px viewport across the layout-sensitive
 * pages: nothing overflows the viewport horizontally, and the hamburger nav
 * (which replaces the desktop bar below md) opens and navigates.
 */
test.use({ viewport: { width: 390, height: 844 } });

const MOBILE_ROUTES = ["/", "/catalog", "/availability", "/service/aws/textract"] as const;

test.describe("mobile (390px)", () => {
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
