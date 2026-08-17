import { expect, test } from "@playwright/test";

import { trackJsErrors } from "./helpers";

const routes = [
  "/prototype/opus",
  "/prototype/opus/dashboard?app=pay-4821",
  "/prototype/opus/onboarding?app=pay-4821",
  "/prototype/opus/scaffolder?app=pay-4821",
  "/prototype/opus/diagnosis?app=pay-4821",
] as const;

for (const route of routes) {
  test(`opus route ${route} renders without JavaScript errors`, async ({ page }) => {
    const errors = trackJsErrors(page);

    const response = await page.goto(route);

    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
