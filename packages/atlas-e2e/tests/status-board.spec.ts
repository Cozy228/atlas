import { expect, test } from "@playwright/test";

import { expectShellWithMockBadge } from "./helpers";

/**
 * D10 — Portal: the status board + self-service registration form hang off the
 * existing APP/LZ selector (Step 7, P24/M3/M12; ADR-0003). The board is
 * aggregation-at-read: its PRIMARY states are the honest ones — a labeled pointer
 * (no adapter / `none` / fetch failure), a loading skeleton, an empty scope. A
 * fetched value is uncited operational status, VISUALLY SEPARATED from cited
 * Evidence (a distinct visual register, not just a caption).
 *
 * FROZEN CONTRACT for Batch 5 (the UI does not exist yet — this spec is authored
 * with the rest of the suite and EXCLUDED from the Batch-0 red-verification loop
 * since there is no dev server there). Batch 5 must satisfy these accessible
 * hooks, all on deterministic mock data (`DEV_MOCKS=1`):
 *
 *   - selecting an APP reveals a "Status board" surface for its scope;
 *   - each entry is either a live value (in the uncited status register, marked
 *     `data-testid="status-value"`) or a labeled pointer (`data-testid=
 *     "status-pointer"` — name + link + an honest "value unavailable" state);
 *   - the uncited value register is visually distinct from cited Evidence
 *     (`data-testid="status-uncited-region"` exists and is separate from any
 *     Evidence/citation region) — the ADR-0003 separation;
 *   - a "Register a location" affordance opens a form with accessible fields
 *     "System", "Kind", "URL" and NO secret/token field;
 *   - after submit, the location appears on the board as a labeled pointer (no
 *     value-capable adapter for a fictional system) — never a fabricated value.
 *
 * All data is fictional (public-safe).
 */

// A per-run numeric suffix (digits only, regex-safe) keeps the name unique across
// runs against a REUSED dev server: the in-memory app store accumulates declared
// APPs, so a fixed name would match multiple stale menu entries and trip strict
// mode. The board is scoped to THIS run's fresh APP, so the registered location
// cannot accumulate across runs either.
const APP_NAME = `Orion Status E2E ${Date.now()}`;
const LOCATION_SYSTEM = "observatory";
const LOCATION_URL = "https://observatory.example.com/d/orion-status-e2e";

test("select an app → the status board renders honest states; register a location → labeled pointer", async ({
  page,
}) => {
  await page.goto("/availability");
  await expectShellWithMockBadge(page);
  await page.waitForLoadState("networkidle");

  // Declare an APP to scope the board by (reusing the Step-3 self-declare form).
  await page.getByRole("button", { name: /app \/ landing zone/i }).click();
  await page.getByRole("menuitem", { name: /declare an app/i }).click();
  await page.getByLabel(/app name/i).fill(APP_NAME);
  await page
    .getByLabel(/landing zones/i)
    .getByRole("checkbox", { name: /AWS Foundation/i })
    .check();
  await page.getByRole("button", { name: /^(save|declare|register)/i }).click();
  await page.waitForLoadState("networkidle");

  // Select the APP; its status board surface appears.
  await page.getByRole("button", { name: /app \/ landing zone/i }).click();
  await page.getByRole("menuitemradio", { name: new RegExp(APP_NAME, "i") }).click();

  const board = page.getByRole("region", { name: /status board/i });
  await expect(board).toBeVisible();

  // ADR-0003: uncited operational values live in a register visually separated
  // from cited Evidence — the separation is a first-class, testable hook.
  await expect(page.getByTestId("status-uncited-region")).toBeVisible();

  // Register a location for a system with no value-capable adapter.
  await page.getByRole("button", { name: /register a location/i }).click();
  await page.getByLabel(/^system/i).fill(LOCATION_SYSTEM);
  await page.getByLabel(/^kind/i).selectOption("dashboard");
  await page.getByLabel(/^url/i).fill(LOCATION_URL);

  // The registration form has NO secret/token field (locked decision 1).
  await expect(page.getByLabel(/token|secret|password/i)).toHaveCount(0);

  await page.getByRole("button", { name: /^(save|register|add)/i }).click();
  await page.waitForLoadState("networkidle");

  // The new location renders as a labeled pointer — honest floor, never a
  // fabricated value (no adapter for a fictional "observatory" system).
  const pointer = page
    .getByTestId("status-pointer")
    .filter({ hasText: new RegExp(LOCATION_SYSTEM, "i") });
  await expect(pointer.first()).toBeVisible();
  await expect(pointer.first().getByText(/value unavailable|no live value|pointer/i)).toBeVisible();
});
