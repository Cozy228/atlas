import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge } from "./helpers";

/**
 * Step 6 (D6) — the internal honesty-instruments dashboard (`/instruments`, F /
 * P16/P20/P22/P28). Unlisted (not in the sitemap) but reachable by direct URL: it
 * renders the negotiation queue ("which source next", P16/P22), the P20/P28 cost
 * metrics, change-feed volume by class, the time-to-verify stats, and an honest
 * since-boot banner (the window resets on every restart — no durable metric store).
 *
 * In DEV_MOCKS mode the metrics registry is empty (mock briefs bypass the live
 * assembly path), so the sections render their honest empty states — this spec
 * asserts the page + banner + sections render; the sorted-desc content is proven
 * by the context-layer route unit test. All data fictional (public-safe).
 */

test("the instruments dashboard renders with the since-boot banner", async ({ page }) => {
  await page.goto("/instruments");
  await expectShellWithMockBadge(page);
  await page.waitForLoadState("networkidle");

  await expect(page.getByRole("heading", { name: /honesty instruments/i })).toBeVisible();

  // The honesty banner: the window is since-boot and says so.
  await expect(page.getByText(/since-boot window/i)).toBeVisible();

  // The negotiation queue — the "which source next" answer (P16/P22).
  await expect(page.getByRole("heading", { name: /negotiation queue/i })).toBeVisible();
  // The P20/P28 cost surfaces.
  await expect(page.getByRole("heading", { name: /agent call share/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /time to brief/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /tokens per brief/i })).toBeVisible();
});

/**
 * D5 (client) — following a brief citation fires the verification-tax beacon
 * (P28, locked decision 6). Visits a real brief page, clicks a citation link, and
 * asserts the `POST /api/internal/instruments/verify` beacon fires with the
 * client-computed `{ moment, sourceId, msSinceRender }` (no identity).
 */
test("following a brief citation fires the verify beacon", async ({ page }) => {
  await page.goto("/briefs/adopt");
  await expectShellWithMockBadge(page);
  await page.waitForLoadState("networkidle");

  // The citation links are the brief's external `target="_blank"` source links.
  const citation = page.locator('main a[target="_blank"][rel="noreferrer"]').first();
  await citation.waitFor({ state: "visible" });

  const beacon = page.waitForRequest(
    (request) =>
      request.url().includes("/api/internal/instruments/verify") && request.method() === "POST",
  );
  // The beacon fires in the onClick, synchronously, before the external tab opens.
  await citation.click();
  const request = await beacon;

  const body = JSON.parse(request.postData() ?? "{}");
  expect(body.moment).toBe("adopt");
  expect(typeof body.sourceId).toBe("string");
  expect(body.sourceId.length).toBeGreaterThan(0);
  expect(typeof body.msSinceRender).toBe("number");
});
