import { expect, test } from "@playwright/test";

/**
 * Production smoke (plan 026 WU11): the mock-free prod build. Each top route
 * returns 200, the SSR shell/nav renders, the "Mock data" badge is ABSENT (the
 * seam contract — prod registers no MSW, so resolveDataMode reports 'live'), and
 * there is no uncaught JS error. NO deterministic-data assertions — honest-empty
 * without creds is expected, and console errors from failed live fetches are not
 * a smoke failure (only uncaught exceptions are).
 */
// NOTE: /overview and /skills are intentionally omitted — both are gated
// (beforeLoad redirects to "/"), so listing them here would silently re-test home.
const TOP_ROUTES = [
  "/",
  "/availability",
  "/catalog",
  "/guidance",
  "/sources",
  "/whatsnew",
  "/support",
] as const;

test.describe("production smoke (mock-free)", () => {
  for (const path of TOP_ROUTES) {
    test(`${path}: 200 + SSR shell + no mode badge + no JS error`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const response = await page.goto(path);
      expect(response?.status(), `${path} HTTP status`).toBeLessThan(400);
      await expect(page.getByRole("link", { name: "Cloud DevEx Portal home" })).toBeVisible(); // SSR shell/nav
      // Badge ABSENT in prod — by stable testid, not copy, so a label rename can't
      // make this seam-contract check pass vacuously.
      await expect(page.getByTestId("data-mode-badge")).toHaveCount(0);
      expect(pageErrors, `pageerror on ${path}`).toEqual([]);
    });
  }
});
