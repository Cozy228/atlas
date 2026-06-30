import { defineConfig } from "@playwright/test";

import { baseURL, channel } from "./pw-env.mjs";

/**
 * Primary E2E config (plan 026). Drives an already-installed SYSTEM browser via
 * `channel` (never downloads Chromium, decision 2). The channel + baseURL rule
 * lives in ./pw-env.mjs — the ONE place shared by the smoke config, the doctor,
 * and the warmup global-setup so they never drift.
 *
 * The primary layer is the mock-FORCED dev server: DEV_MOCKS=1 makes data
 * hermetic regardless of any local .env.local; LLM_PROVIDER=simulated makes Ask
 * deterministic. `global-setup` warms Vite's cold dep optimization (and asserts
 * the server really is mock-forced) before the parallel run.
 */
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : [["list"]],
  use: {
    baseURL,
    channel,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // No video: the zero-download policy (decision 2) skips Playwright's ffmpeg,
    // and a video-recording context throws at newPage without it. Trace +
    // screenshot already cover failures and need no ffmpeg.
    // Pin the emulated scheme so axe's color-contrast results (theme-dependent)
    // match the committed baseline across local + CI headless runs.
    colorScheme: "light",
  },
  // Windows-safe: flags go through the `env` object (never a `VAR=value cmd` shell
  // prefix) and the command is pnpm-only (no Unix shell). DEV_MOCK_LATENCY_MS
  // widens the deferred-loading window so skeleton states are observable (WU8)
  // without making the suite slow.
  webServer: {
    command: "pnpm --filter @atlas/portal dev",
    env: { DEV_MOCKS: "1", LLM_PROVIDER: "simulated", DEV_MOCK_LATENCY_MS: "250" },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // Bound teardown: SIGTERM the dev server, then SIGKILL after 15s if `vite dev`
    // (pnpm → vite → nitro) doesn't exit cleanly — otherwise `playwright test` can
    // hang indefinitely after the suite finishes (observed locally; in CI it would
    // wedge the job to its 20-min timeout).
    gracefulShutdown: { signal: "SIGTERM", timeout: 15_000 },
    timeout: 120_000,
  },
});
