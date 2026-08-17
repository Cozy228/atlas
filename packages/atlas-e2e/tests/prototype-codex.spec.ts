import { expect, test } from "@playwright/test";

import { trackJsErrors } from "./helpers";

const routes = [
  "/prototype/codex",
  "/prototype/codex/dashboard",
  "/prototype/codex/onboarding",
  "/prototype/codex/scaffolder",
  "/prototype/codex/diagnosis",
] as const;

for (const route of routes) {
  test(`codex route ${route} renders without JavaScript errors`, async ({ page }) => {
    const errors = trackJsErrors(page);

    const response = await page.goto(route);

    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator("main")).toBeVisible();
    expect(errors).toEqual([]);
  });
}
