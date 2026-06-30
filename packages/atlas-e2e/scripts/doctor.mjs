// @ts-check
/**
 * Browser doctor (plan 026 WU2, decision 8). Proves the zero-download system
 * browser actually LAUNCHES + closes — not merely that specs are enumerable
 * (`--list` only does the latter). Run as the FIRST CI step so runner-image
 * drift ("Edge moved / not installed") fails fast and legibly instead of as an
 * opaque mid-suite timeout.
 *
 * `channel` comes from ../pw-env.mjs — the SAME source the configs use — so the
 * doctor can never green-light a channel the suite then fails on. It drives the
 * system browser, so an empty Playwright browser cache is irrelevant — we never
 * download or use a bundled Chromium.
 */
import { chromium } from "@playwright/test";

import { channel } from "../pw-env.mjs";

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
