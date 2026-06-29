// @ts-check
/**
 * Browser doctor (plan 026 WU2, decision 8). Proves the zero-download system
 * browser actually LAUNCHES + closes — not merely that specs are enumerable
 * (`--list` only does the latter). Run as the FIRST CI step so runner-image
 * drift ("Edge moved / not installed") fails fast and legibly instead of as an
 * opaque mid-suite timeout.
 *
 * Resolves the SAME channel as playwright.config.ts (a .mjs cannot import the
 * .ts config, so the one-line rule is inlined): PW_CHANNEL override, else
 * `chrome` on macOS / `msedge` elsewhere (Windows + Linux CI images ship Edge).
 * `channel` drives the system browser, so an empty Playwright browser cache is
 * irrelevant — we never download or use a bundled Chromium.
 */
import { chromium } from "@playwright/test";

const channel = process.env.PW_CHANNEL ?? (process.platform === "darwin" ? "chrome" : "msedge");

try {
  const browser = await chromium.launch({ channel });
  const version = browser.version();
  await browser.close();
  console.log(`OK: launched ${channel} (${version})`);
  process.exit(0);
} catch (error) {
  const installHint = channel === "chrome" ? "Google Chrome" : "Microsoft Edge";
  console.error(`FAIL: could not launch browser channel "${channel}".`);
  console.error(
    `E2E drives an already-installed system browser (zero Chromium download). ` +
      `Install ${installHint}, or set PW_CHANNEL to a channel that is installed.`,
  );
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}
