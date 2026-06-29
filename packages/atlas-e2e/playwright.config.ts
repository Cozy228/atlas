import { defineConfig } from "@playwright/test";

/**
 * Primary E2E config (plan 026). Drives an already-installed SYSTEM browser via
 * the `channel` option — we never download Chromium (decision 2). Edge ships on
 * the Windows/Linux CI images; macOS uses Chrome. Override with PW_CHANNEL. The
 * same resolution is inlined in scripts/doctor.mjs (a .mjs cannot import this .ts).
 * The mock-forced dev-server `webServer` block is added in WU3; this base pins the
 * zero-download channel + diagnostics.
 */
const channel = process.env.PW_CHANNEL ?? (process.platform === "darwin" ? "chrome" : "msedge");

// One source for both the readiness probe and in-test navigation, so they never
// drift. `localhost` (not 127.0.0.1) on purpose: the dev server binds the IPv6
// loopback (::1) here, which a hard-coded IPv4 probe would miss; localhost
// resolves to whatever the dev server actually bound, on every OS.
const baseURL = process.env.PW_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
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
  // Primary layer: the mock-FORCED dev server. DEV_MOCKS=1 makes data hermetic
  // regardless of any local .env.local; LLM_PROVIDER=simulated makes Ask
  // deterministic. Windows-safe: flags go through the `env` object (never a
  // `VAR=value cmd` shell prefix) and the command is pnpm-only (no Unix shell).
  webServer: {
    command: "pnpm --filter @atlas/portal dev",
    // DEV_MOCK_LATENCY_MS widens the deferred-loading window so the skeleton
    // states are observable (WU8) without making the suite slow.
    env: { DEV_MOCKS: "1", LLM_PROVIDER: "simulated", DEV_MOCK_LATENCY_MS: "250" },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
