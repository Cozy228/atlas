import { expect, test } from "@playwright/test";

/**
 * Walking-skeleton proof (plan 026 WU3): the mock-forced dev server boots, the
 * channel browser navigates via baseURL, and the deterministic mock seam is live
 * — asserted through the "Mock data" badge (WU-B), the one cross-page signal that
 * MSW fixtures (not real source systems) are being served. WU4 broadens this to
 * the full route matrix.
 */
test("the app boots on the mock-forced dev server", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("data-mode-badge")).toBeVisible();
});
