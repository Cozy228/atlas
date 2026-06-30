import { expect, type Page } from "@playwright/test";

/**
 * A known fixture service-detail path. Specs that just need "some service detail"
 * (mobile overflow, a11y) reference this ONE constant instead of re-hardcoding the
 * slug, so a fixture rename is a single edit. Specs that discover slugs black-box
 * use {@link firstHref} instead.
 */
export const SAMPLE_SERVICE_PATH = "/service/aws/textract";

/**
 * Record uncaught exceptions (`pageerror`) and `console.error`s for the life of a
 * page. A route smoke fails if either fires — a healthy render emits neither.
 */
export function trackJsErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // Browser-emitted sub-resource load failures — favicon / touch-icons the app
    // doesn't define, and honest-gap source 4xx the app handles gracefully
    // (ADR-0006) — are network noise, not app errors. Real bugs surface as a
    // pageerror (uncaught exception) or an app-thrown console.error with a real
    // message.
    if (text.includes("Failed to load resource")) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

/**
 * Black-box dynamic-slug discovery (decision 10): the first in-app link whose
 * href starts with `prefix`, read from whatever page is currently loaded. Keeps
 * the suite decoupled from context-layer fixture internals.
 */
export async function firstHref(page: Page, prefix: string): Promise<string> {
  const link = page.locator(`a[href^="${prefix}"]`).first();
  await link.waitFor({ state: "attached" });
  const href = await link.getAttribute("href");
  expect(href, `expected an in-app link starting with "${prefix}"`).toBeTruthy();
  return href as string;
}

/**
 * Assert the app shell rendered + the deterministic mock-data badge (WU-B) is
 * present — the primary-layer signal that MSW fixtures, not real source systems,
 * are being served. Targets the badge by `data-testid`, not its copy, so a label
 * change can't make this assertion silently pass/fail.
 */
export async function expectShellWithMockBadge(page: Page): Promise<void> {
  // .first() — some pages nest their own <header>/<main> inside the shell's;
  // we assert the outer shell landmark.
  await expect(page.locator("header").first()).toBeVisible();
  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.getByTestId("data-mode-badge")).toBeVisible();
}
