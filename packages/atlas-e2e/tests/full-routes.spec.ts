import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge, firstHref, trackJsErrors } from "./helpers";

/**
 * Full-route smoke baseline (plan 026 WU4). Every navigable route: HTTP < 400,
 * the app shell + mock badge render, and NO uncaught exception / app console
 * error. Dynamic slugs are black-box-discovered from the rendered UI
 * (decision 10), so the suite never imports context-layer fixture internals.
 */

const STATIC_ROUTES = [
  "/",
  "/overview",
  "/availability",
  "/catalog",
  "/guidance",
  "/sources",
  "/skills",
  "/whatsnew",
  "/support",
] as const;

test.describe("full-route smoke (mock-forced)", () => {
  for (const path of STATIC_ROUTES) {
    test(`static ${path}: 200 + shell + mock badge + no JS error`, async ({ page }) => {
      const errors = trackJsErrors(page);
      const response = await page.goto(path);
      expect(response?.status(), `${path} HTTP status`).toBeLessThan(400);
      await expectShellWithMockBadge(page);
      expect(errors, `JS errors on ${path}`).toEqual([]);
    });
  }

  test("dynamic detail routes (discovered slugs): 200 + shell + no JS error", async ({ page }) => {
    const errors = trackJsErrors(page);

    // service ← /catalog (default Services tab).
    await page.goto("/catalog");
    await page.waitForLoadState("networkidle"); // let the client hydrate before the tab click
    const serviceHref = await firstHref(page, "/service/");

    // policy ← the "Security policies" catalog tab (services is the default tab).
    const policiesTab = page.getByRole("tab", { name: "Security policies" });
    await policiesTab.click();
    await expect(policiesTab).toHaveAttribute("aria-selected", "true");
    const policyHref = await firstHref(page, "/policies/");

    // guidance ← /guidance.
    await page.goto("/guidance");
    const guidanceHref = await firstHref(page, "/guidance/");

    // source ← a guidance detail's source references. (The /sources index lists
    // sources without /sources/<id> anchors; guidance details cite them directly.)
    await page.goto(guidanceHref);
    const sourceHref = await firstHref(page, "/sources/");

    // NOTE: /releases/$releaseId is intentionally omitted here — the mock
    // "What's New" feed is honest-empty (0 updates), so there is no release
    // detail to visit. WU8 exercises the not-found release path (error boundary).

    const discovered: Record<string, string> = {
      service: serviceHref,
      policy: policyHref,
      guidance: guidanceHref,
      source: sourceHref,
    };
    for (const [name, href] of Object.entries(discovered)) {
      const response = await page.goto(href);
      expect(response?.status(), `${name} (${href}) HTTP status`).toBeLessThan(400);
      await expectShellWithMockBadge(page);
    }
    expect(errors, "JS errors across dynamic routes").toEqual([]);
  });
});
