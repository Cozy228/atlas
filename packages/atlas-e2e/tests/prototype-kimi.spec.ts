import { expect, test } from "@playwright/test";

import { trackJsErrors } from "./helpers";

const routes = [
  "/prototype/kimi",
  "/prototype/kimi/dashboard",
  "/prototype/kimi/onboarding",
  "/prototype/kimi/scaffolder",
  "/prototype/kimi/diagnosis",
  "/prototype/kimi/runs/pay-deploy-0142",
] as const;

for (const route of routes) {
  test(`kimi route ${route} renders without JavaScript errors`, async ({ page }) => {
    const errors = trackJsErrors(page);

    const response = await page.goto(route);

    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
