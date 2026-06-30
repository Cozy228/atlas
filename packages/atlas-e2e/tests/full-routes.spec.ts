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
  "/availability",
  "/catalog",
  "/guidance",
  "/sources",
  "/whatsnew",
  "/support",
] as const;

// Gated routes: beforeLoad throws redirect to "/". Listed separately so the smoke
// loop above doesn't silently re-test home under a "/overview" / "/skills" title.
const GATED_ROUTES = ["/overview", "/skills"] as const;

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

  for (const path of GATED_ROUTES) {
    test(`gated ${path}: redirects to home`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL((url) => url.pathname === "/");
      await expectShellWithMockBadge(page);
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

    // release ← /whatsnew (the release-notes fixture is now wired into the dev
    // mock env, so the feed has updates and each links to a detail route).
    await page.goto("/whatsnew");
    const releaseHref = await firstHref(page, "/releases/");

    const discovered: Record<string, string> = {
      service: serviceHref,
      policy: policyHref,
      guidance: guidanceHref,
      source: sourceHref,
      release: releaseHref,
    };
    for (const [name, href] of Object.entries(discovered)) {
      const response = await page.goto(href);
      expect(response?.status(), `${name} (${href}) HTTP status`).toBeLessThan(400);
      await expectShellWithMockBadge(page);
    }
    expect(errors, "JS errors across dynamic routes").toEqual([]);
  });
});
