import { expect, test } from "@playwright/test";

test("feedback submits through the explicit Portal API", async ({ page }) => {
  await page.goto("/service/aws/textract");
  await page.waitForLoadState("networkidle");
  const details = page.getByPlaceholder(
    "What is missing or wrong? Be specific so the owning team can act.",
  );
  await details.fill("Add region guidance for the fictional rollout.");

  await expect(page.getByRole("button", { name: "Send feedback" })).toBeEnabled();
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/feedback") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send feedback" }).click();
  const response = await responsePromise;

  expect(response.status()).toBe(201);
  await expect(page.getByText("Feedback sent")).toBeVisible();
});
