import { expect, test } from "@playwright/test";

/**
 * Production smoke (plan 026 WU11): the mock-free prod build. Each top route
 * returns 200, the SPA client boots, the "Mock data" badge is ABSENT (the
 * seam contract — prod registers no MSW, so resolveDataMode reports 'live'), and
 * there is no uncaught JS error. NO deterministic-data assertions — honest-empty
 * without creds is expected, and console errors from failed live fetches are not
 * a smoke failure (only uncaught exceptions are).
 */
// NOTE: /overview and /skills are intentionally omitted — both are gated
// (beforeLoad redirects to "/"), so listing them here would silently re-test home.
const TOP_ROUTES = [
  "/",
  "/availability",
  "/catalog",
  "/guidance",
  "/sources",
  "/whatsnew",
  "/support",
] as const;

test.describe("production smoke (mock-free)", () => {
  test("Portal-owned API routes before the Context API catch-all", async ({ request }) => {
    const response = await request.get("/api/portal/data-mode");

    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ dataMode: "live" });
  });

  test("deep links return a meaningful static SPA shell before client boot", async ({
    request,
  }) => {
    const response = await request.get("/catalog", {
      headers: { accept: "text/html" },
    });
    const html = await response.text();

    expect(response.status()).toBe(200);
    expect(html).toContain("data-atlas-static-shell");
    expect(html).toContain("Welcome to the Cloud DevEx Portal");
    expect(html).toContain('aria-label="Primary"');
    expect(html).toContain('type="module"');
    expect(html).not.toContain("__TSR_SSR__");
  });

  test("home remains useful when JavaScript has not started", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    try {
      const response = await page.goto("/");

      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: "Welcome to the Cloud DevEx Portal" }),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "Browse the catalog" })).toHaveAttribute(
        "href",
        "/catalog",
      );
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("cold home stays within the browser request budget", async ({ page }) => {
    const responses: string[] = [];
    page.on("response", (response) => responses.push(new URL(response.url()).pathname));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    expect(responses.filter((path) => path.endsWith(".js")).length).toBeLessThanOrEqual(14);
    expect(responses.filter((path) => path.startsWith("/api/portal/")).sort()).toEqual([
      "/api/portal/announcements",
      "/api/portal/availability",
    ]);
    expect(responses.length).toBeLessThanOrEqual(20);
  });

  for (const path of TOP_ROUTES) {
    test(`${path}: 200 + SPA client boot + no mode badge + no JS error`, async ({ page }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      const response = await page.goto(path);
      expect(response?.status(), `${path} HTTP status`).toBeLessThan(400);
      await expect(page.locator("[data-atlas-static-shell]")).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Cloud DevEx Portal home" })).toBeVisible();
      // Badge ABSENT in prod — by stable testid, not copy, so a label rename can't
      // make this seam-contract check pass vacuously.
      await expect(page.getByTestId("data-mode-badge")).toHaveCount(0);
      expect(pageErrors, `pageerror on ${path}`).toEqual([]);
    });
  }

  test("native landing-zone selection updates the client state", async ({ page }) => {
    await page.goto("/");
    const selector = page.getByRole("combobox", { name: "Current landing zone" });

    await expect(selector.locator("option")).toHaveCount(3);
    await selector.selectOption("azure");

    await expect(selector).toHaveValue("azure");
    await expect(page.locator("[data-current-landing-zone=azure]")).toBeVisible();
  });

  test("native mobile navigation opens on the first client interaction", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.getByRole("dialog", { name: "Mobile navigation" })).toBeVisible();
    await page.getByRole("button", { name: "Close navigation menu" }).click();
    await expect(page.getByRole("dialog", { name: "Mobile navigation" })).toBeHidden();
  });
});
