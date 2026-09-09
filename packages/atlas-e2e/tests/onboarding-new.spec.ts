import { expect, test, type Page } from "@playwright/test";

async function revealEcsDetails(page: Page) {
  for (const trigger of await page
    .locator(".ecs-live-run")
    .getByRole("button", {
      name: /^(Run details|Complete missing inputs|Simulation controls)$/,
    })
    .all()) {
    if ((await trigger.getAttribute("aria-expanded")) === "false") await trigger.click();
  }
}

const ROUTE = "/prototype/onboarding-new";

async function openOnboarding(page: Page) {
  await page.goto(ROUTE);
  await expect(page.locator(".onboarding-new")).toBeVisible();
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toBeVisible();
}

async function completeApplicationCode(page: Page, code = "APP1") {
  await page.locator("#on-value").fill(code);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText(
    "Create SailPoint / EntraID groups for AWS onboarding",
  );
}

async function fillCurrentTaskFields(page: Page) {
  const body = page.locator(".on-task-body[aria-hidden='false']");
  const inputs = body.locator("input");

  for (let index = 0; index < (await inputs.count()); index += 1) {
    const input = inputs.nth(index);
    if (!(await input.isVisible()) || (await input.isDisabled())) continue;

    const id = await input.getAttribute("id");
    const type = await input.getAttribute("type");
    const label = (await input.getAttribute("aria-label")) ?? "";
    if (id === "on-value") {
      const placeholder = await input.getAttribute("placeholder");
      await input.fill(placeholder === "123456789012" ? "123456789012" : "APP1");
    } else if (label === "Infrastructure repository: Repository") {
      await input.fill("checkout-api-infra");
    } else if (label === "Application repository: Repository") {
      await input.fill("checkout-api");
    } else if (type === "url" || /url/i.test(label)) {
      await input.fill(`https://example.test/atlas/${index + 1}`);
    } else if (/email/i.test(label)) {
      await input.fill("demo@example.test");
    } else {
      await input.fill(`DEMO-${index + 1}`);
    }
  }
}

async function completeCurrentTask(page: Page) {
  const child = page.locator(".on-task-body[aria-hidden='false'] .on-scaffold");
  if (await child.isVisible()) {
    await child.getByRole("textbox", { name: "Service name", exact: true }).fill("checkout-api");
    await child.getByRole("button", { name: "Preview changes", exact: true }).click();
    await child.getByRole("button", { name: "Authorize GitHub App" }).click();
    await child.getByRole("button", { name: "Create infrastructure PR", exact: true }).click();
    await revealEcsDetails(page);
    await child.getByRole("button", { name: "Pause simulation" }).click();
    await revealEcsDetails(page);
    await child.getByRole("button", { name: "Simulate merge", exact: true }).click();
    await child.getByRole("button", { name: /^Check (PR|run) status$/ }).click();
    await revealEcsDetails(page);
    await child.getByRole("button", { name: "Simulate infrastructure run" }).click();
    await child.getByRole("button", { name: "Simulate TFE run" }).click();
    await child.getByRole("button", { name: "Simulate successful run" }).click();
    await child.getByRole("button", { name: "Simulate plan approval" }).click();
    await child.getByRole("button", { name: "Simulate successful run" }).click();
    await child.getByRole("button", { name: "Create application PR", exact: true }).click();
    await revealEcsDetails(page);
    await child.getByRole("button", { name: "Simulate merge", exact: true }).click();
    await child.getByRole("button", { name: /^Check (PR|run) status$/ }).click();
    await revealEcsDetails(page);
    await child
      .getByRole("button", { name: "Simulate Harness resources run", exact: true })
      .click();
    await child.getByRole("button", { name: "Simulate successful run" }).click();
    await revealEcsDetails(page);
    await child.getByRole("button", { name: "Simulate CI run" }).click();
    await child.getByRole("button", { name: "Simulate successful run" }).click();
    await revealEcsDetails(page);
    await child.getByRole("button", { name: "Simulate deploy run" }).click();
    await child.getByRole("button", { name: "Simulate successful run" }).click();
    await child.getByRole("button", { name: "Finish ECS journey" }).click();
    await expect(
      page.getByRole("heading", { name: "Setup summary & support", exact: true }),
    ).toBeVisible();
    return;
  }

  const heading = page.locator(".on-task-body[aria-hidden='false'] h1");
  const before = await heading.innerText();
  await fillCurrentTaskFields(page);
  await page
    .locator(".on-task-body[aria-hidden='false']")
    .getByRole("button", { name: /^(Continue|Mark complete and continue|Complete setup)$/ })
    .click();
  await expect(heading).not.toHaveText(before, { timeout: 5_000 });
}

test("onboarding starts without a sidebar and keeps progress available through the rail", async ({
  page,
}) => {
  await openOnboarding(page);

  const frame = page.locator(".onboarding-new");
  await expect(frame).toHaveAttribute("data-sidebar", "none");
  await expect(page.locator("aside[aria-label='Setup progress']")).toHaveCount(0);

  await page.getByRole("button", { name: "View all tasks", exact: true }).click();
  const sidebar = page.locator("aside[aria-label='Setup progress']");
  await expect(sidebar).toBeVisible();
  await expect(frame).toHaveAttribute("data-sidebar", "expanded");

  await sidebar.getByRole("button", { name: "Application code", exact: true }).click();
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText(
    "Confirm application code",
  );
  await page.reload();
  await expect(frame).toHaveAttribute("data-sidebar", "expanded");
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText(
    "Confirm application code",
  );

  await sidebar.getByRole("button", { name: "Collapse progress sidebar" }).click();
  await expect(frame).toHaveAttribute("data-sidebar", "collapsed");
  await expect(sidebar.getByRole("button", { name: "Expand progress sidebar" })).toBeVisible();

  await sidebar.getByRole("button", { name: "Expand progress sidebar" }).click();
  await expect(frame).toHaveAttribute("data-sidebar", "expanded");
});

test("onboarding phase and task navigation work from the expanded and collapsed rail", async ({
  page,
}) => {
  await openOnboarding(page);
  await page.getByRole("button", { name: "View all tasks", exact: true }).click();

  const taskNav = page.locator("nav[aria-label='Onboarding tasks']");
  const codePhase = taskNav.getByRole("button", { name: /^Code & projects/ });
  await codePhase.click();
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText(
    "Harness onboarding",
  );

  await codePhase.click();
  await expect(codePhase).toHaveAttribute("aria-expanded", "false");
  await codePhase.click();
  await expect(codePhase).toHaveAttribute("aria-expanded", "true");

  await taskNav.getByRole("button", { name: "Git onboarding", exact: true }).click();
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText("Git onboarding");

  const sidebar = page.locator("aside[aria-label='Setup progress']");
  await sidebar.getByRole("button", { name: "Collapse progress sidebar" }).click();
  const rail = sidebar.locator("nav[aria-label='Onboarding phases']");
  await rail.getByRole("button", { name: /^Terraform, 0 of 3 tasks complete$/ }).click();
  await expect(page.locator(".onboarding-new")).toHaveAttribute("data-sidebar", "expanded");
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText(
    "Terraform Enterprise - create AD groups and enable access",
  );
});

test("required values block empty completion while dependencies remain advisory", async ({
  page,
}) => {
  await openOnboarding(page);

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.locator("#on-error")).toHaveText("Enter your application code to continue.");
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText(
    "Confirm application code",
  );

  await page.getByRole("button", { name: "View all tasks", exact: true }).click();
  const taskNav = page.locator("nav[aria-label='Onboarding tasks']");
  await taskNav.getByRole("button", { name: /^ECS service/ }).click();
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText(
    "Configure service",
  );

  await expect(page.getByRole("textbox", { name: "Service name", exact: true })).toBeVisible();
});

test("required request ID and URL validation block an empty or invalid request", async ({
  page,
}) => {
  await openOnboarding(page);
  await completeApplicationCode(page);

  const heading = page.locator(".on-task-body[aria-hidden='false'] h1");
  await page.getByRole("button", { name: "Mark complete and continue" }).click();
  await expect(heading).toHaveText("Create SailPoint / EntraID groups for AWS onboarding");
  await expect(page.getByLabel("Group creation request: Request ID")).toBeFocused();

  await page.getByLabel("Group creation request: Request ID").fill("RITM-2048");
  await page.getByLabel("Group creation request: Details URL").fill("not-a-url");
  await page.getByRole("button", { name: "Mark complete and continue" }).click();
  await expect(heading).toHaveText("Create SailPoint / EntraID groups for AWS onboarding");
});

test("completed request inputs become searchable, copyable, and persistent artifacts", async ({
  page,
}) => {
  await openOnboarding(page);
  await completeApplicationCode(page);

  await page.getByLabel("Group creation request: Request ID").fill("RITM-2048");
  await page
    .getByLabel("Group creation request: Details URL")
    .fill("https://example.test/requests/RITM-2048");
  await page.getByRole("button", { name: "Mark complete and continue" }).click();
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText(
    "Create group-mapping RITM requests",
  );

  const artifactsButton = page.getByRole("button", { name: "Artifacts" });
  await artifactsButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await expect(dialog.locator(".on-resource-row input")).toHaveCount(0);
  await expect(dialog).not.toContainText("Add details");
  const search = dialog.getByRole("searchbox", { name: "Find an artifact" });
  await search.fill("RITM-2048");
  await expect(dialog.locator(".on-resource-count")).toContainText("1 artifact");

  const request = dialog.getByRole("group", { name: "Group creation request" });
  await expect(request).toContainText("RITM-2048");
  await request.getByRole("button", { name: "Details for Group creation request" }).click();
  await expect(request.getByRole("link", { name: "Open artifact" })).toHaveAttribute(
    "href",
    "https://example.test/requests/RITM-2048",
  );

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await request.getByRole("button", { name: "Copy Link for Group creation request" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("https://example.test/requests/RITM-2048");
  await expect(dialog.locator(".on-sheet-note")).toHaveText("Group creation request: Link copied.");

  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(artifactsButton).toBeFocused();

  await page.reload();
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText(
    "Create group-mapping RITM requests",
  );
  await page.getByRole("button", { name: "Artifacts" }).click();
  const reloadedDialog = page.getByRole("dialog");
  await reloadedDialog.getByRole("searchbox", { name: "Find an artifact" }).fill("RITM-2048");
  await expect(reloadedDialog.getByRole("group", { name: "Group creation request" })).toContainText(
    "RITM-2048",
  );
});

test("Undo removes the latest completion and Start a new demo resets the journey", async ({
  page,
}) => {
  await openOnboarding(page);
  await completeApplicationCode(page);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText(
    "Confirm application code",
  );
  const taskCount = Number(
    (await page.locator(".on-toc-caption").innerText()).match(/(\d+) tasks/)?.[1],
  );
  await expect(page.locator(".on-sidebar")).toContainText(`0 of ${taskCount} tasks complete`);

  await completeApplicationCode(page);
  await page.getByRole("button", { name: "Start a new demo", exact: true }).click();
  await expect(page.locator(".onboarding-new")).toHaveAttribute("data-sidebar", "none");
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).toHaveText(
    "Confirm application code",
  );
  await expect(page.locator("#on-value")).toHaveValue("");
});

test("the onboarding summary reaches the final completed state", async ({ page }) => {
  test.setTimeout(120_000);
  await openOnboarding(page);
  await page.getByRole("button", { name: "View all tasks", exact: true }).click();

  const caption = await page.locator(".on-toc-caption").innerText();
  const taskCount = Number(caption.match(/(\d+) tasks/)?.[1]);
  expect(Number.isInteger(taskCount)).toBe(true);
  const completed = page.locator(".on-sidebar-bottom");

  for (let index = 0; index < taskCount; index += 1) {
    await completeCurrentTask(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("atlas.onboarding-new.source.v4") ?? "{}").completed
              .length,
        ),
      )
      .toBe(index + 1);
    if (await page.locator(".on-scaffold").isVisible())
      await expect(completed).toHaveText("0 of 9 steps complete");
    else await expect(completed).toHaveText(`${index + 1} of ${taskCount} tasks complete`);
  }

  await expect(page.getByRole("heading", { name: "Onboarding checklist complete" })).toBeVisible();
  await expect(page.locator(".on-description")).toContainText(
    "recorded steps and artifacts are saved",
  );
  await expect(page.locator(".on-completion-feedback")).toContainText(/All \d+ tasks completed/);
});

test("image preview, theme controls, and reduced motion remain usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openOnboarding(page);
  await completeApplicationCode(page);

  await expect(
    page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
  ).resolves.toBe(true);

  const imageTrigger = page.getByRole("button", { name: /^Enlarge / });
  await imageTrigger.click();
  const imageDialog = page.getByRole("dialog");
  await expect(imageDialog).toBeVisible();
  await imageDialog.getByRole("button", { name: "Close image preview" }).click();
  await expect(imageDialog).toBeHidden();

  await page.getByRole("button", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await page.getByRole("button", { name: "Light theme" }).click();
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
});

test("Artifacts sheet and Cmd-K restore focus to their invoking control", async ({ page }) => {
  await openOnboarding(page);
  await completeApplicationCode(page);

  const artifactsButton = page.getByRole("button", { name: "Artifacts" });
  await artifactsButton.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(artifactsButton).toBeFocused();

  await artifactsButton.focus();
  await page.keyboard.press("ControlOrMeta+k");
  const searchDialog = page.getByRole("dialog");
  await expect(searchDialog).toBeVisible();
  await expect(searchDialog.getByRole("combobox", { name: "Search the catalog" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(searchDialog).toBeHidden();
  await expect(artifactsButton).toBeFocused();
});

test("summary uses the same phase navigation as other onboarding steps", async ({ page }) => {
  await openOnboarding(page);
  await page.getByRole("button", { name: "View all tasks", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "Onboarding tasks", exact: true });
  await nav.getByRole("button", { name: /^ECS service/ }).click();
  await expect(page.locator(".on-sidebar-body")).not.toContainText("Summary & support");
  await page.getByRole("button", { name: "Back to onboarding", exact: true }).last().click();
  const summaryPhase = nav.locator(".on-phase").filter({ hasText: "Summary & support" });
  const summaryTrigger = summaryPhase.getByRole("button", { name: /^Summary & support/ });
  await summaryTrigger.click();
  await expect(summaryTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(summaryPhase.locator(".on-task-list button")).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(nav.locator(".on-summary-nav")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Setup summary & support", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".on-context")).toContainText("Summary & support · Task 1 of 1");
  await summaryTrigger.click();
  await expect(summaryTrigger).toHaveAttribute("aria-expanded", "false");
  await summaryTrigger.click();
  await expect(summaryTrigger).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({ path: "/tmp/atlas-summary-unified.png", fullPage: true });
});
