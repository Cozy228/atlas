import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge, SAMPLE_POLICY_PATH } from "./helpers";

/**
 * The core journey (plan 026 WU5): the product spine end-to-end on deterministic
 * mock data — home → catalog search → a service → availability → a policy →
 * search overlay. Role/label/href selectors, never brittle positional CSS.
 */
test("core journey: home → catalog → service → availability → policy → search", async ({
  page,
}) => {
  // 1. Home renders.
  await page.goto("/");
  await expectShellWithMockBadge(page);

  // 2. Catalog: filtering by a fixture term narrows the results.
  await page.goto("/catalog");
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder(/Filter services/i).fill("Textract");
  const textractCard = page.locator('a[href="/service/aws/textract"]').first();
  await expect(textractCard).toBeVisible();
  await expect(page.locator('a[href="/service/aws/bedrock"]')).toHaveCount(0); // non-match filtered out

  // 3. Into the service detail.
  await textractCard.click();
  await expect(page).toHaveURL(/\/service\/aws\/textract/);
  await expect(page.getByRole("heading", { name: /textract/i }).first()).toBeVisible();
  await expectShellWithMockBadge(page);

  // 4. Availability matrix renders with cells.
  await page.goto("/availability");
  await expect(page.getByRole("table").first()).toBeVisible();
  expect(await page.getByRole("cell").count()).toBeGreaterThan(0);

  // 5. A security policy detail. The catalog's "Security policies" tab was retired
  // (policies are being folded onto each service — see catalog/adopted.tsx) and no
  // surface renders a /policies/ link anymore, so the journey reaches the policy
  // detail by direct nav — the same style the availability leg above uses. The
  // per-page assertions (on-policy URL + shell + mock badge) are unchanged.
  await page.goto(SAMPLE_POLICY_PATH);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/policies\//);
  await expectShellWithMockBadge(page);

  // 6. Search overlay: the ⌘K catalog jump finds a service and navigates to it.
  // (The conversational Ask mode is built but hidden behind a feature flag, so
  // the overlay is search-only for now — see SHOW_AI in ask-overlay.tsx.)
  await page.locator("header").getByRole("button", { name: "Search the catalog" }).click();
  const overlay = page.getByRole("dialog");
  await overlay.getByPlaceholder("Search for anything…").fill("Textract");
  const result = overlay.getByRole("button", { name: /textract/i }).first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/service\/aws\/textract/);
  await expectShellWithMockBadge(page);
});
