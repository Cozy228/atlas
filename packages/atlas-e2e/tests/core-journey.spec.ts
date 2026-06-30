import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge } from "./helpers";

/**
 * The core journey (plan 026 WU5): the product spine end-to-end on deterministic
 * mock data — home → catalog search → a service → availability → a policy → Ask
 * (simulated LLM). Role/label/href selectors, never brittle positional CSS.
 */
test("core journey: home → catalog → service → availability → policy → ask", async ({ page }) => {
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

  // 5. A security policy detail, reached via the catalog's policy tab.
  await page.goto("/catalog");
  await page.waitForLoadState("networkidle");
  const policiesTab = page.getByRole("tab", { name: "Security policies" });
  await policiesTab.click();
  await expect(policiesTab).toHaveAttribute("aria-selected", "true");
  const policyCard = page.locator('a[href^="/policies/"]').first();
  await policyCard.click();
  await expect(page).toHaveURL(/\/policies\//);
  await expectShellWithMockBadge(page);

  // 6. Ask: the simulated provider yields a deterministic response region.
  await page.getByRole("button", { name: "Search Atlas catalog" }).click(); // open the overlay
  // Scope to the dialog: the always-mounted FAB shares the accessible name
  // "Ask Atlas", so an unscoped getByRole would be a strict-mode 2-match if the
  // overlay's modal aria-hide ever changes.
  await page.getByRole("dialog").getByRole("button", { name: "Ask Atlas" }).click(); // switch to the Ask tab
  await page.getByPlaceholder("How do I get started?").fill("How do I use Textract?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText("How do I use Textract?")).toBeVisible(); // question echoed
  // pending shimmer clears (or never shows — simulated is instant), then a
  // non-empty assistant response region is present.
  await expect(page.getByText("Atlas is consulting registered sources…")).toBeHidden({
    timeout: 15_000,
  });
  const assistantReply = page.locator(".is-assistant").last();
  await expect(assistantReply).toBeVisible();
  await expect(assistantReply).not.toBeEmpty();
});
