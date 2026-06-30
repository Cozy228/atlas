import { defineConfig } from "@playwright/test";

import { baseURL, channel } from "./pw-env.mjs";

/**
 * Smoke layer config (plan 026 WU11): the REAL production build, mock-free. No
 * DEV_MOCKS — the prod build never registers the MSW plugin — so this validates
 * boot + SSR/hydration/routing + the mode badge's ABSENCE, WITHOUT asserting
 * specific data (honest-empty without creds is expected). `pnpm e2e:smoke` runs
 * the portal build BEFORE this config's webServer starts `pnpm start`.
 *
 * Channel + baseURL come from ./pw-env.mjs (shared with the primary config + the
 * doctor). A separate file from playwright.config.ts because the webServer
 * lifecycle differs (prod build + `pnpm start` vs `vite dev`) and both bind :3000,
 * so they cannot co-exist as one config's webServer.
 */
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
    // No video: zero-download skips ffmpeg, which a recording context needs.
    colorScheme: "light",
  },
  webServer: {
    command: "pnpm --filter @atlas/portal start",
    env: { PORT: "3000" }, // NO DEV_MOCKS → prod is mock-free
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // Bound teardown (parity with the primary config) so a wedged server never
    // hangs the run past the SIGKILL fallback.
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    timeout: 120_000,
  },
});
