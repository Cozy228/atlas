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

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : [["list"]],
  use: {
    channel,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
});
