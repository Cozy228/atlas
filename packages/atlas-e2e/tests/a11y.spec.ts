import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { firstHref, SAMPLE_SERVICE_PATH } from "./helpers";

/**
 * Baseline accessibility (plan 026 WU10). The UI was not built a11y-first, so a
 * hard zero-violations gate on day one would force fix-all-or-suppress-all.
 * Instead we SNAPSHOT the current serious/critical violations as an accepted
 * baseline and gate only on NEW rule violations — the debt stays visible
 * (recorded below, not silently suppressed) and can shrink but never grow.
 *
 * Known baseline = tracked a11y debt to burn down:
 *   home          definition-list
 *   catalog       color-contrast
 *   service       color-contrast
 *   availability  aria-conditional-attr, aria-prohibited-attr, nested-interactive
 *   policy        (clean)
 *   ask overlay   (clean — the modal traps scope to the dialog)
 */
const A11Y_BASELINE = {
  home: ["definition-list"],
  catalog: ["color-contrast"],
  service: ["color-contrast"],
  availability: ["aria-conditional-attr", "aria-prohibited-attr", "nested-interactive"],
  policy: [] as string[],
  ask: [] as string[],
} satisfies Record<string, readonly string[]>;

async function expectNoNewViolations(page: Page, surface: keyof typeof A11Y_BASELINE) {
  const results = await new AxeBuilder({ page }).analyze();
  const found = [
    ...new Set(
      results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => v.id),
    ),
  ].sort();
  const regressions = found.filter((id) => !A11Y_BASELINE[surface].includes(id));
  expect(regressions, `NEW serious/critical a11y violations on "${surface}"`).toEqual([]);
}

test.describe("baseline accessibility (mock-forced)", () => {
  test("home", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expectNoNewViolations(page, "home");
  });

  test("catalog", async ({ page }) => {
    await page.goto("/catalog");
    await page.waitForLoadState("networkidle");
    await expectNoNewViolations(page, "catalog");
  });

  test("service detail", async ({ page }) => {
    await page.goto(SAMPLE_SERVICE_PATH);
    await page.waitForLoadState("networkidle");
    await expectNoNewViolations(page, "service");
  });

  test("availability", async ({ page }) => {
    await page.goto("/availability");
    await page.waitForLoadState("networkidle");
    await expectNoNewViolations(page, "availability");
  });

  test("policy detail", async ({ page }) => {
    await page.goto("/catalog");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Security policies" }).click();
    await page.goto(await firstHref(page, "/policies/"));
    await page.waitForLoadState("networkidle");
    await expectNoNewViolations(page, "policy");
  });

  test("ask overlay", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.locator("header").getByRole("button", { name: "Search Atlas catalog" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Ask Atlas" }).click();
    await expectNoNewViolations(page, "ask");
  });
});
