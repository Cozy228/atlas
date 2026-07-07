import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge } from "./helpers";

/**
 * D9 — Portal: the APP selector subsumes the LZ selector (Step 3, locked
 * decision 8; P17/P21/M3). Registering an APP through the self-declare form
 * makes it appear in the selector with the unconditional `self-declared` badge,
 * and choosing it narrows the zone choice to the APP's declared set. With no APP
 * selected, the surface is LZ-only, unchanged (the revert posture).
 *
 * FROZEN CONTRACT for Batch 4 (the UI does not exist yet — this spec is authored
 * with the rest of the suite and excluded from the Batch-0 red-verification loop
 * since there is no dev server there). Batch 4 must satisfy these accessible
 * hooks, all on deterministic mock data (`DEV_MOCKS=1`):
 *
 *   - a control named "App / landing zone" opens the combined selector;
 *   - the selector offers a "Declare an app" affordance opening a form with
 *     accessible fields "App name", "Landing zones", "Services";
 *   - after submit, the APP is listed in the selector, labeled `self-declared`;
 *   - selecting the APP narrows the LZ options to its declared set.
 *
 * All data is fictional (public-safe).
 */

// No regex-special characters: the name is fed straight into `new RegExp(...)`.
// A per-run numeric suffix (digits only, still regex-safe) keeps the name unique
// across runs against a REUSED dev server: the in-memory app store accumulates
// declared APPs, so a fixed name would match multiple stale menu entries from
// earlier runs and trip Playwright strict mode. A unique name can only ever match
// this run's APP.
const APP_NAME = `Orion Checkout E2E ${Date.now()}`;

test("declare an app → it appears in the selector, self-declared, and narrows the zones", async ({
  page,
}) => {
  await page.goto("/availability");
  await expectShellWithMockBadge(page);
  // Let the heavy availability route finish hydrating before interacting, so the
  // dropdown trigger's handler is wired (same networkidle gate as core-journey).
  await page.waitForLoadState("networkidle");

  // Open the combined APP / landing-zone selector.
  await page.getByRole("button", { name: /app \/ landing zone/i }).click();

  // Baseline (no APP): the raw landing zones are offered — LZ-only behavior.
  await expect(page.getByRole("menuitemradio", { name: /AWS Foundation/i })).toBeVisible();

  // Declare a new APP through the self-declare form (the P21 fallback).
  await page.getByRole("menuitem", { name: /declare an app/i }).click();
  await page.getByLabel(/app name/i).fill(APP_NAME);
  await page
    .getByLabel(/landing zones/i)
    .getByRole("checkbox", { name: /AWS Foundation/i })
    .check();
  await page.getByRole("button", { name: /^(save|declare|register)/i }).click();

  // The registration round-trips + the apps query refetches; let it settle.
  await page.waitForLoadState("networkidle");

  // The APP now appears in the selector, carrying the unconditional badge.
  await page.getByRole("button", { name: /app \/ landing zone/i }).click();
  const appOption = page.getByRole("menuitemradio", { name: new RegExp(APP_NAME, "i") });
  await expect(appOption).toBeVisible();
  await expect(page.getByText(/self-declared/i).first()).toBeVisible();

  // Choosing the APP narrows the zone choice to its declared set (one member),
  // so the non-member zones are no longer offered as free LZ picks.
  await appOption.click();
  await expect(page.getByText(new RegExp(APP_NAME, "i")).first()).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: /Azure/i })).toHaveCount(0);
});
