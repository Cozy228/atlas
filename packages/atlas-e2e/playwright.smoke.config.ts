import { defineConfig } from "@playwright/test";

/**
 * Smoke layer config (plan 026 WU11): the REAL production build, mock-free. No
 * DEV_MOCKS — the prod build never registers the MSW plugin — so this validates
 * boot + SSR/hydration/routing + the mode badge's ABSENCE, WITHOUT asserting
 * specific data (honest-empty without creds is expected). `pnpm e2e:smoke` runs
 * the portal build BEFORE this config's webServer starts `pnpm start`.
 *
 * Channel + diagnostics mirror playwright.config.ts (kept self-contained so the
 * two layers never share mutable state); a .mjs/.ts split rules out importing.
 */
const channel = process.env.PW_CHANNEL ?? (process.platform === "darwin" ? "chrome" : "msedge");
const baseURL = process.env.PW_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./smoke",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : [["list"]],
  use: {
    baseURL,
    channel,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --filter @atlas/portal start",
    env: { PORT: "3000" }, // NO DEV_MOCKS → prod is mock-free
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
