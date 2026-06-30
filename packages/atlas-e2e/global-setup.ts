import { chromium } from "@playwright/test";

import { baseURL, channel, WARMUP_ROUTES } from "./pw-env.mjs";

/**
 * Primary-layer global setup (plan 026 stability). Runs AFTER the webServer is up
 * (Playwright sequences plugin/webServer setup before global setup) and BEFORE the
 * fullyParallel workers, doing two jobs against one throwaway browser session:
 *
 *  1. Fail fast + legibly if the server under test is NOT the hermetic mock server
 *     — e.g. `reuseExistingServer` reused a plain `pnpm dev` on :3000 that has real
 *     creds / no DEV_MOCKS=1. Without this, every badge / Ask / skeleton spec would
 *     fail later with a confusing, unrelated message (webServer.env only applies to
 *     a server Playwright STARTS, never a reused one).
 *
 *  2. Warm Vite's cold on-demand dep optimization by visiting the heavy lazy routes
 *     + opening the Ask overlay once, so a mid-run re-optimize never aborts a
 *     coincident navigation (net::ERR_ABORTED).
 */
export default async function warmAndVerifyMockServer(): Promise<void> {
  const browser = await chromium.launch({ channel });
  const page = await browser.newPage();
  try {
    await page.goto(`${baseURL}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });

    const isMock = await page
      .getByTestId("data-mode-badge")
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (!isMock) {
      throw new Error(
        `E2E primary layer requires a mock-forced dev server, but the 'Mock data' badge is absent at ${baseURL}. ` +
          "Playwright starts one with DEV_MOCKS=1 automatically; if another server is already running there " +
          "(reuseExistingServer), stop it or start it with DEV_MOCKS=1.",
      );
    }

    for (const route of WARMUP_ROUTES) {
      // Best-effort: a transient cold-start hiccup must not fail the run — the
      // optimizer still advances from a partial load, and the specs assert real
      // behavior themselves.
      await page
        .goto(`${baseURL}${route}`, { waitUntil: "networkidle", timeout: 60_000 })
        .catch(() => {});
    }

    // The Ask chat is a lazy dynamic import (markdown + highlighter); open it once
    // so its deps optimize before a test races the same import.
    await page
      .goto(`${baseURL}/`, { waitUntil: "domcontentloaded", timeout: 60_000 })
      .catch(() => {});
    await page
      .getByRole("button", { name: "Search Atlas catalog" })
      .click({ timeout: 10_000 })
      .catch(() => {});
    await page
      .getByRole("button", { name: "Ask Atlas" })
      .click({ timeout: 10_000 })
      .catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
  } finally {
    await browser.close();
  }
}
