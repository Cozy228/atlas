import { expect, test } from "@playwright/test";

const storageKey = "atlas.onboarding-new.source.v4";

test("group-mapping draft reuses task facts, asks for missing context, and survives reload", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(
    ({ key }) => {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(
        key,
        JSON.stringify({
          active: 2,
          navigation: "expanded",
          completed: [0, 1],
          values: {
            0: "DEMO",
            "artifact:harness-mapping:number": "REQ-DEMO-H",
            "artifact:aws-mapping:number": "REQ-DEMO-A",
            "artifact:tfe-mapping:number": "REQ-DEMO-T",
          },
        }),
      );
    },
    { key: storageKey },
  );
  await page.goto("/prototype/onboarding-new");
  await page.getByRole("button", { name: "Prepare group-mapping email", exact: true }).click();
  const draft = page.getByRole("region", { name: "Prepare group-mapping email", exact: true });
  await expect(draft.getByRole("button", { name: "Copy draft" })).toBeEnabled();
  await expect(draft.getByRole("link", { name: "Open email draft" })).toHaveAttribute(
    "href",
    /mailto:/,
  );
  await draft.getByRole("button", { name: "Copy draft" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "[REPLACE: Application name]",
  );
  await draft
    .getByRole("textbox", { name: "Application name", exact: true })
    .fill("Demo & Checkout");
  await draft.getByRole("textbox", { name: "App-owner approval reference" }).fill("APR-DEMO-42");
  await expect(draft.getByLabel("Prepare group-mapping email preview")).toContainText(
    "SSO_TFE_PROD_DEMO_PRJ_OPERATOR",
  );
  const href = await draft.getByRole("link", { name: "Open email draft" }).getAttribute("href");
  expect(href).toBeTruthy();
  const mail = new URL(href!);
  expect(mail.pathname).toBe("idam-ops@example.com");
  expect(mail.searchParams.get("body")).toContain("Demo & Checkout (DEMO)");
  expect(mail.searchParams.get("body")).toContain("REQ-DEMO-T");
  await draft.getByRole("button", { name: "Copy draft" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("APR-DEMO-42");
  await page
    .getByRole("textbox", { name: "TFE group-mapping request: Request ID", exact: true })
    .fill("REQ-DEMO-UPDATED");
  await expect(draft.getByLabel("Prepare group-mapping email preview")).toContainText(
    "REQ-DEMO-UPDATED",
  );
  await page.reload();
  await page.getByRole("button", { name: "Prepare group-mapping email", exact: true }).click();
  await expect(draft.getByRole("textbox", { name: "Application name", exact: true })).toHaveValue(
    "Demo & Checkout",
  );
  await expect(draft.getByLabel("Prepare group-mapping email preview")).toContainText(
    "REQ-DEMO-UPDATED",
  );
  const progress = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "{}"),
    storageKey,
  );
  expect(progress.completed).toEqual([0, 1]);
});

test("copy-only access guidance labels missing groups as placeholders and links to their task", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key }) => {
      localStorage.setItem(
        key,
        JSON.stringify({
          active: 5,
          navigation: "expanded",
          completed: [0],
          values: { 0: "DEMO" },
        }),
      );
    },
    { key: storageKey },
  );
  await page.goto("/prototype/onboarding-new");
  await page.getByRole("button", { name: "Prepare access request", exact: true }).click();
  const draft = page.getByRole("region", { name: "Prepare access request", exact: true });
  await expect(draft.getByRole("button", { name: "Copy draft" })).toBeEnabled();
  await expect(draft.getByLabel("Prepare access request preview")).toContainText(
    "[REPLACE: TFE groups]",
  );
  await draft.getByRole("button", { name: "TFE groups", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Create SailPoint / EntraID groups for AWS onboarding",
      level: 1,
    }),
  ).toBeVisible();
});
