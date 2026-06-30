import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { firstHref, SAMPLE_SERVICE_PATH } from "./helpers";

/**
 * Baseline accessibility (plan 026 WU10). The UI was not built a11y-first, so a
 * hard zero-violations gate on day one would force fix-all-or-suppress-all.
 * Instead we SNAPSHOT the current serious/critical violations as an accepted
 * baseline and gate on any INCREASE — the debt stays visible (recorded below, not
 * silently suppressed) and can shrink but never grow.
 *
 * The baseline records each rule's NODE COUNT per surface (not just the rule id),
 * so a NEW node failing an already-listed rule (e.g. one more low-contrast element
 * on catalog) is caught — not only a brand-new rule id. A count may legitimately
 * DROP as debt is fixed; lower the number here when it does.
 *
 * Known debt to burn down (rule: node count):
 *   home          definition-list:1
 *   catalog       color-contrast:32
 *   service       color-contrast:1
 *   availability  aria-conditional-attr:18, aria-prohibited-attr:90, nested-interactive:1
 *   policy        (clean)
 *   search overlay (clean — the modal traps scope to the dialog)
 */
const A11Y_BASELINE = {
  home: { "definition-list": 1 },
  catalog: { "color-contrast": 32 },
  service: { "color-contrast": 1 },
  availability: {
    "aria-conditional-attr": 18,
    "aria-prohibited-attr": 90,
    "nested-interactive": 1,
  },
  policy: {},
  search: {},
} satisfies Record<string, Record<string, number>>;

async function expectNoNewViolations(page: Page, surface: keyof typeof A11Y_BASELINE) {
  const results = await new AxeBuilder({ page }).analyze();
  const counts: Record<string, number> = {};
  for (const v of results.violations) {
    if (v.impact === "serious" || v.impact === "critical") {
      counts[v.id] = (counts[v.id] ?? 0) + v.nodes.length;
    }
  }
  const baseline: Record<string, number> = A11Y_BASELINE[surface];
  // A regression is any rule whose node count EXCEEDS the snapshot (a brand-new
  // rule has baseline 0). Counts may shrink (debt burndown) but never grow.
  const regressions = Object.entries(counts)
    .filter(([id, n]) => n > (baseline[id] ?? 0))
    .map(([id, n]) => `${id}: ${n} > ${baseline[id] ?? 0}`)
    .sort();
  expect(regressions, `NEW or increased serious/critical a11y on "${surface}"`).toEqual([]);
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

  test("search overlay", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.locator("header").getByRole("button", { name: "Search the catalog" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoNewViolations(page, "search");
  });
});
