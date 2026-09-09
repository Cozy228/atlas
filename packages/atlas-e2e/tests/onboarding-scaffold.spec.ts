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

test("nested ECS journey animates PR checks through stack creation", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/prototype/onboarding-new");
  await page.evaluate(() => {
    localStorage.removeItem("atlas.onboarding-new.source.v3");
    localStorage.setItem(
      "atlas.onboarding-new.source.v4",
      JSON.stringify({
        active: 15,
        completed: [0, 10],
        values: {
          0: "DEMO",
          10: "123456789012",
          "artifact:infra-repository:repository": "checkout-api-infra",
          "artifact:app-repository:repository": "checkout-api",
        },
        navigation: "expanded",
      }),
    );
  });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Configure service", exact: true })).toBeVisible();
  const configurationLayout = page.locator(".on-scaffold-decisions-layout");
  await expect(configurationLayout).toHaveCSS("display", "grid");
  const entry = await page.getByRole("region", { name: "Service configuration" }).boundingBox();
  const summary = await page
    .getByRole("complementary", { name: "Configuration summary" })
    .boundingBox();
  expect(entry).not.toBeNull();
  expect(summary).not.toBeNull();
  if (!entry || !summary) throw new Error("Configuration columns must be rendered");
  expect(summary.x).toBeGreaterThanOrEqual(entry.x + entry.width + 31);
  expect(Math.abs(summary.y - entry.y)).toBeLessThan(2);
  await expect(page.getByLabel("Service name", { exact: true })).toHaveCSS("max-width", "416px");
  await expect(page.locator(".on-scaffold-decision-help")).toHaveCSS("font-size", "12px");

  await expect(
    page.getByRole("button", { name: /Start ECS journey|Resume ECS journey/ }),
  ).toHaveCount(0);
  const nav = page
    .locator(".on-sidebar-body")
    .getByRole("navigation", { name: "ECS journey steps" });
  await expect(nav.getByRole("button", { name: "Configure service", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.getByRole("button", { name: "Collapse progress sidebar" }).click();
  await expect(
    page
      .locator(".on-rail .ecs-nav-collapsed")
      .getByRole("button", { name: "Review changes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expand progress sidebar" }).click();
  await page.getByRole("textbox", { name: "Service name", exact: true }).fill("checkout-api");
  await page.getByRole("button", { name: "Edit AWS account", exact: true }).click();
  const account = page.getByRole("textbox", { name: "AWS account", exact: true });
  await account.fill("999999999999");
  await account.press("Escape");
  await expect(page.getByRole("button", { name: "Edit AWS account" })).toContainText(
    "123456789012",
  );
  await page.getByRole("button", { name: "Edit AWS account" }).click();
  await account.fill("210987654321");
  await account.press("Enter");
  await expect(page.getByRole("complementary", { name: "Configuration summary" })).toContainText(
    "Edited for this service",
  );
  await expect(page.locator(".on-scaffold-stage-panel")).toHaveCount(1);
  await expect(page.locator(".on-scaffold-stage-panel")).toHaveCSS("filter", "blur(0px)");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/atlas-ecs-config.png", fullPage: true });
  await page.getByRole("button", { name: "Preview changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible();
  await expect(page.locator(".on-scaffold-stage-panel")).toHaveCount(1);
  await expect(page.locator(".sa-diagram")).toContainText("ECR repository");
  await expect(page.locator(".sa-diagram")).not.toContainText("Internal callers");
  await expect(page.locator(".on-scaffold-stage-panel")).toHaveCount(1);
  await expect(page.locator(".on-scaffold-stage-panel")).toHaveCSS("filter", "blur(0px)");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/atlas-ecs-preview.png", fullPage: true });
  const alb = page.getByRole("button", { name: "Inspect Application load balancer", exact: true });
  await alb.hover();
  expect(
    await alb.evaluate((element) => {
      const hit = element.querySelector(".sa-node-hit")!.getBoundingClientRect();
      const label = element.querySelector(".sa-node-title")!.getBoundingClientRect();
      return hit.left <= label.left && hit.right >= label.right;
    }),
  ).toBe(true);
  await expect(page.getByRole("button", { name: "Inspect checkout-api", exact: true })).toHaveCount(
    0,
  );
  await alb.click();
  await expect(page.locator(".on-scaffold-file-browser")).toContainText("ecs/service.tf");
  await expect(page.locator(".on-scaffold-file-tree")).not.toContainText(
    "ecs/task-definition.json",
  );
  await expect(page.getByText("Selected resource", { exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Architecture", exact: true }).click();
  await page.getByRole("button", { name: "Inspect ECR repository", exact: true }).press("Enter");
  await expect(page.locator(".on-scaffold-file-browser")).toContainText("ecs/service.tf");
  await expect(page.locator(".on-scaffold-file-browser")).toBeVisible();
  await expect(page.locator(".on-scaffold-stage-panel")).toHaveCount(1);
  await expect(page.locator(".on-scaffold-stage-panel")).toHaveCSS("filter", "blur(0px)");
  await expect(page.locator(".on-scaffold-preview-panel")).toHaveCSS("filter", "blur(0px)");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/atlas-ecs-files.png", fullPage: true });
  await expect(page.getByRole("button", { name: "Create infrastructure PR" })).toBeDisabled();
  await page.getByRole("button", { name: "Authorize GitHub App" }).click();
  await page.getByRole("button", { name: "Create infrastructure PR" }).click();
  const run = page.locator(".ecs-live-run");
  await expect(run).toHaveAttribute("data-phase", "waiting-pr");
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Pause simulation" }).click();
  await expect(run.locator("[data-pr-state='open']")).toBeVisible();
  await expect(page.locator(".sa-execution .sa-paths")).toHaveCount(0);
  await expect(page.locator(".sa-execution .sa-edge-label")).toHaveCount(0);
  await expect(page.locator(".sa-execution .sa-node")).toHaveCount(5);
  await expect(page.locator(".sa-execution .sa-cluster")).toHaveCount(1);
  const graphHandle = await page.locator(".sa-execution .sa-diagram").elementHandle();
  const initialPositions = await page
    .locator(".sa-execution .sa-node")
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("transform")));
  await expect(page.locator(".ecs-live-checks")).toHaveCount(0);
  await expect(page.locator(".sa-node[data-execution-state='unavailable']")).not.toHaveCount(0);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/atlas-ecs-waiting.png", fullPage: true });
  await page.getByRole("button", { name: /^Check (PR|run) status$/ }).click();
  await expect(run).toHaveAttribute("data-phase", "waiting-pr");
  await expect(page.getByRole("button", { name: "Simulate merge", exact: true })).toHaveCount(1);
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate merge", exact: true }).click();
  await page.getByRole("button", { name: /^Check (PR|run) status$/ }).click();
  await expect(run).toHaveAttribute("data-phase", "checking-pipeline");
  await expect(page.getByRole("region", { name: "Deployment architecture" })).toBeVisible();
  await expect(page.locator(".sa-execution .sa-node")).toHaveCount(5);
  expect(await graphHandle?.evaluate((element) => element.isConnected)).toBe(true);
  await expect(run.getByRole("button", { name: "Run details", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(
    run.locator(".ecs-input-disclosure [data-slot='accordion-content']"),
  ).toHaveAttribute("aria-hidden", "true");
  await expect(run.getByRole("link", { name: "Open pipeline in Harness" })).toHaveAttribute(
    "href",
    /harness\.example\.com/,
  );
  await revealEcsDetails(page);
  await expect(page.getByRole("textbox", { name: "AWS account", exact: true })).toHaveValue(
    "210987654321",
  );
  const runAccount = page.getByRole("textbox", { name: "AWS account", exact: true });
  await runAccount.focus();
  expect(
    await runAccount.evaluate((input) => {
      const rect = input.getBoundingClientRect();
      let ancestor = input.parentElement;
      while (ancestor) {
        if (["hidden", "clip", "auto", "scroll"].includes(getComputedStyle(ancestor).overflowX)) {
          const bounds = ancestor.getBoundingClientRect();
          if (rect.left - 5 < bounds.left || rect.right + 5 > bounds.right) return false;
        }
        ancestor = ancestor.parentElement;
      }
      return true;
    }),
  ).toBe(true);
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate infrastructure run" }).click();
  await expect(run).toHaveAttribute("data-phase", "waiting-tfe");
  await expect(
    page.getByRole("heading", { name: "Waiting for Terraform Enterprise" }),
  ).toBeVisible();
  await expect(page.locator('.sa-node[data-focused="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Check run status" }).click();
  await expect(run).toHaveAttribute("data-phase", "waiting-tfe");
  await page.getByRole("button", { name: "Simulate TFE run" }).click();
  await expect(run).toHaveAttribute("data-phase", "planning");
  await page.getByRole("button", { name: "Check run status" }).click();
  await expect(run).toHaveAttribute("data-phase", "planning");
  await page.getByRole("button", { name: "Simulate successful run" }).click();
  await expect(run).toHaveAttribute("data-phase", "awaiting-apply");
  await page.getByRole("button", { name: "Simulate plan approval" }).click();
  await expect(run).toHaveAttribute("data-phase", "applying");
  await expect(page.locator(".sa-execution .sa-paths")).toHaveCount(0);
  await page.getByRole("button", { name: "Simulate successful run" }).click();
  await expect(run).toHaveAttribute("data-phase", "task-definition");
  await revealEcsDetails(page);
  await expect(page.locator('.sa-node[data-node-id="iam"]')).toHaveAttribute(
    "data-execution-state",
    "created",
  );
  await expect(page.locator('.sa-node[data-node-id="iam"]')).toHaveCSS("opacity", "1");
  await expect(page.locator('.sa-node[data-node-id="ecs"]')).toHaveAttribute(
    "data-execution-state",
    "unavailable",
  );
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/atlas-ecs-infra-created.png", fullPage: true });
  await page.getByRole("button", { name: "Review files", exact: true }).click();
  await expect(page.getByRole("region", { name: "File content" })).toContainText(
    "arn:aws:iam::210987654321:role/checkout-api-task",
  );
  await expect(page.locator(".on-scaffold-file-tree")).not.toContainText("ecs/service.tf");
  await expect(page.locator(".on-scaffold-file-tree")).toContainText("ecs/deployment.tf");
  await page.getByRole("button", { name: "Create application PR", exact: true }).click();
  await expect(run).toHaveAttribute("data-phase", "waiting-app-pr");
  await page.getByRole("button", { name: /^Check (PR|run) status$/ }).click();
  await expect(run).toHaveAttribute("data-phase", "waiting-app-pr");
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate merge", exact: true }).click();
  await page.getByRole("button", { name: /^Check (PR|run) status$/ }).click();
  await expect(run).toHaveAttribute("data-phase", "waiting-resources");
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate Harness resources run", exact: true }).click();
  await page.getByRole("button", { name: "Simulate successful run" }).click();
  await expect(run).toHaveAttribute("data-phase", "waiting-ci");
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate CI run" }).click();
  await expect(run).toHaveAttribute("data-phase", "building");
  await expect(page.locator('.sa-node[data-node-id="ecr"]')).toHaveAttribute(
    "data-focused",
    "true",
  );
  await page.getByRole("button", { name: "Simulate successful run" }).click();
  await expect(run).toHaveAttribute("data-phase", "waiting-deploy");
  await revealEcsDetails(page);
  await expect(page.getByRole("textbox", { name: "Image tag", exact: true })).toHaveValue(
    "build-001",
  );
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate deploy run" }).click();
  await expect(run).toHaveAttribute("data-phase", "deploying");
  await expect(page.locator(".sa-execution .sa-paths")).toHaveCount(0);
  await expect(page.locator('.sa-node[data-node-id="ecs"]')).toHaveAttribute(
    "data-focused",
    "true",
  );
  await page.getByRole("button", { name: "Simulate successful run" }).click();
  await expect(run).toHaveAttribute("data-phase", "complete");
  await expect(run).toContainText("Your service is ready");
  await expect(run).not.toContainText("Deployment healthy");
  await expect(run.getByRole("link", { name: /checkout-api.dev.example.com/ })).toHaveAttribute(
    "href",
    "https://checkout-api.dev.example.com",
  );
  await expect(run.getByText("Networking details", { exact: true })).toHaveCount(0);
  await expect
    .poll(async () => {
      const sizes = await page.locator(".sa-execution .sa-node > svg").evaluateAll((nodes) =>
        nodes.map((node) => ({
          width: node.getBoundingClientRect().width,
          height: node.getBoundingClientRect().height,
        })),
      );
      return Math.max(
        Math.max(...sizes.map((size) => size.width)) - Math.min(...sizes.map((size) => size.width)),
        Math.max(...sizes.map((size) => size.height)) -
          Math.min(...sizes.map((size) => size.height)),
      );
    })
    .toBeLessThan(0.1);

  await expect(page.locator(".sa-execution .sa-node")).toHaveCount(5);
  expect(
    await page
      .locator(".sa-execution .sa-node")
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute("transform"))),
  ).toEqual(initialPositions);
  expect(await graphHandle?.evaluate((element) => element.isConnected)).toBe(true);
  await expect(run).not.toContainText("Apply complete");
  await expect(page.locator('.sa-node[data-node-id="iam"]')).toHaveAttribute(
    "data-execution-state",
    "created",
  );
  await expect(run).not.toContainText("Platform role reference");
  await expect(page.locator(".ecs-live-checks")).toHaveCount(0);
  await expect(page.locator(".sa-execution .sa-paths")).toHaveCount(1);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/atlas-ecs-created.png", fullPage: true });
  await page.reload();
  await expect(run).toHaveAttribute("data-phase", "complete");
  await page.getByRole("button", { name: "Back to onboarding", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Confirm application code" })).toBeVisible();
  let stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atlas.onboarding-new.source.v4") ?? "{}"),
  );
  expect(stored.completed).toEqual([0, 10]);
  await page
    .getByRole("navigation", { name: "Onboarding tasks" })
    .getByRole("button", { name: /^ECS service/ })
    .click();
  await page.getByRole("button", { name: "Finish ECS journey" }).click();
  await expect(page.getByRole("heading", { name: "Setup summary & support" })).toBeVisible();
  stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atlas.onboarding-new.source.v4") ?? "{}"),
  );
  expect(stored.completed).toEqual([0, 10, 15]);
  expect(stored.values["10"]).toBe("123456789012");
  expect(stored.values["artifact:deployment:service"]).toBe("checkout-api");
  expect(stored.values["artifact:app-pr:url"]).toBeUndefined();
  expect(errors).toEqual([]);
});

test("editing a completed ECS configuration reopens review without deleting recorded PRs", async ({
  page,
}) => {
  await page.goto("/prototype/onboarding-new");
  await page.evaluate(() => {
    const values: Record<string, string> = {
      "0": "DEMO",
      "10": "123456789012",
      "scaffold:service_name": "old-service",
      "scaffold:stage": "config",
      "artifact:infra-pr:url": "https://git.example.com/infra/pull/1",
      "artifact:app-pr:url": "https://git.example.com/app/pull/2",
      "journey:ecs-service:verified": "true",
    };
    for (const stage of ["config", "preview", "result", "pipelines", "run", "verify"])
      values[`journey:ecs-service:completed:${stage}`] = "true";
    localStorage.setItem(
      "atlas.onboarding-new.source.v4",
      JSON.stringify({ active: 15, completed: [0, 10, 15], values, navigation: "expanded" }),
    );
  });
  await page.reload();
  await page.getByRole("textbox", { name: "Service name", exact: true }).fill("new-service");
  const nav = page
    .locator(".on-sidebar-body")
    .getByRole("navigation", { name: "ECS journey steps" });
  await nav.getByRole("button", { name: "Infrastructure PR", exact: true }).click();
  await expect(
    page.getByText(
      "Review the generated changes and create pull requests before running this step.",
    ),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atlas.onboarding-new.source.v4") ?? "{}"),
  );
  expect(stored.completed).toEqual([0, 10]);
  expect(stored.values["journey:ecs-service:verified"]).toBe("false");
  expect(stored.values["artifact:infra-pr:url"]).toBe("https://git.example.com/infra/pull/1");
});

test("build method resize stays monotonic", async ({ page }) => {
  await page.goto("/prototype/onboarding-new");
  await page.evaluate(() =>
    localStorage.setItem(
      "atlas.onboarding-new.source.v4",
      JSON.stringify({
        active: 15,
        completed: [0, 10],
        values: { 0: "DEMO", 10: "123456789012" },
        navigation: "expanded",
      }),
    ),
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Configure service", exact: true })).toBeVisible();
  for (const direction of [1, -1]) {
    await page.waitForTimeout(1000);
    const sampling = page.evaluate(async () => {
      const element = document.querySelector(".on-content-transition");
      const heights: number[] = [];
      const start = performance.now();
      await new Promise<void>((resolve) => {
        function sample() {
          heights.push(element?.getBoundingClientRect().height ?? 0);
          if (performance.now() - start < 1600) requestAnimationFrame(sample);
          else resolve();
        }
        sample();
      });
      return heights;
    });
    await page.locator('.on-scaffold-build-settings [data-slot="accordion-trigger"]').click();
    const heights = await sampling;
    expect((heights.at(-1)! - heights[0]!) * direction).toBeGreaterThan(0);
    for (let index = 1; index < heights.length; index++) {
      expect((heights[index]! - heights[index - 1]!) * direction).toBeGreaterThanOrEqual(-0.5);
    }
  }
});

test("unmerged PRs and unstarted pipelines never advance with time", async ({ page }) => {
  await page.goto("/prototype/onboarding-new");
  await page.evaluate(() =>
    localStorage.setItem(
      "atlas.onboarding-new.source.v4",
      JSON.stringify({
        active: 15,
        completed: [0, 10],
        navigation: "expanded",
        values: {
          0: "DEMO",
          10: "123456789012",
          "scaffold:service_name": "checkout-api",
          "scaffold:stage": "result",
          "artifact:infra-repository:repository": "checkout-api-infra",
          "artifact:app-repository:repository": "checkout-api",
          "journey:ecs-service:github-authorized": "true",
          "journey:ecs-service:pr:infra": "simulated",
          "journey:ecs-service:run-phase": "waiting-pr",
          "journey:ecs-service:pr-state:infra": "open",
          "journey:ecs-service:pr-state:app": "open",
        },
      }),
    ),
  );
  await page.clock.install();
  await page.reload();
  const run = page.locator(".ecs-live-run");
  await page.clock.fastForward(30000);
  await expect(run).toHaveAttribute("data-phase", "waiting-pr");
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate merge", exact: true }).click();
  await page.clock.fastForward(5000);
  await expect(run).toHaveAttribute("data-phase", "checking-pipeline");
  await page.clock.fastForward(30000);
  await expect(run).toHaveAttribute("data-phase", "checking-pipeline");
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate infrastructure run" }).click();
  await expect(run).toHaveAttribute("data-phase", "waiting-tfe");
  await expect(
    page.getByRole("heading", { name: "Waiting for Terraform Enterprise" }),
  ).toBeVisible();
  await expect(page.locator('.sa-node[data-focused="true"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Check run status" }).click();
  await expect(run).toHaveAttribute("data-phase", "waiting-tfe");
  await page.getByRole("button", { name: "Simulate TFE run" }).click();
  await page.clock.fastForward(5100);
  await expect(run).toHaveAttribute("data-phase", "awaiting-apply");
  await page.clock.fastForward(30000);
  await expect(run).toHaveAttribute("data-phase", "awaiting-apply");
  await page.getByRole("button", { name: "Simulate plan approval" }).click();
  await expect(run).toHaveAttribute("data-phase", "applying");
  await page.clock.fastForward(1900);
  await expect(page.locator('.sa-execution .sa-node[data-focused="true"]')).toHaveAttribute(
    "data-node-id",
    "iam",
  );
  await page.clock.fastForward(6500);
  await expect(run).toHaveAttribute("data-phase", "task-definition");
  await revealEcsDetails(page);
  await page.clock.fastForward(30000);
  await expect(run).toHaveAttribute("data-phase", "task-definition");
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Create application PR", exact: true }).click();
  await page.clock.fastForward(30000);
  await expect(run).toHaveAttribute("data-phase", "waiting-app-pr");
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate merge", exact: true }).click();
  await page.clock.fastForward(5000);
  await expect(run).toHaveAttribute("data-phase", "waiting-resources");
  await page.clock.fastForward(30000);
  await expect(run).toHaveAttribute("data-phase", "waiting-resources");
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate Harness resources run", exact: true }).click();
  await page.clock.fastForward(4100);
  await expect(run).toHaveAttribute("data-phase", "waiting-ci");
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate CI run" }).click();
  await page.clock.fastForward(5100);
  await expect(run).toHaveAttribute("data-phase", "waiting-deploy");
  await page.clock.fastForward(30000);
  await expect(run).toHaveAttribute("data-phase", "waiting-deploy");
  await revealEcsDetails(page);
  await page.getByRole("button", { name: "Simulate deploy run" }).click();
  await page.clock.fastForward(5600);
  await expect(run).toHaveAttribute("data-phase", "complete");
  await page.getByRole("button", { name: "Replay simulation" }).click();
  await expect(run).toHaveAttribute("data-phase", "waiting-pr");
  await expect(page.locator('[data-pr-state="open"]')).toHaveCount(1);
});

test("saved deployment still requires Harness resource setup", async ({ page }) => {
  await page.goto("/prototype/onboarding-new");
  await page.evaluate(() =>
    localStorage.setItem(
      "atlas.onboarding-new.source.v4",
      JSON.stringify({
        active: 15,
        completed: [0, 10, 15],
        navigation: "expanded",
        values: {
          0: "DEMO",
          10: "123456789012",
          "scaffold:stage": "verify",
          "journey:ecs-service:run-phase": "complete",
          "journey:ecs-service:pr-state:infra": "merged",
          "journey:ecs-service:pr-state:app": "merged",
          "artifact:infra-pr:url": "https://git.example.com/existing-infra/pull/42",
        },
      }),
    ),
  );
  await page.reload();
  await expect(page.locator(".ecs-live-run")).toHaveAttribute("data-phase", "waiting-resources");
  await expect(page.getByRole("button", { name: "Finish ECS journey", exact: true })).toHaveCount(
    0,
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("atlas.onboarding-new.source.v4") ?? "{}"),
  );
  expect(saved.values["artifact:infra-pr:url"]).toBe(
    "https://git.example.com/existing-infra/pull/42",
  );
  expect(saved.completed).not.toContain(15);
});

test("legacy repository phases return to configuration and keep Preview available", async ({
  page,
}) => {
  await page.goto("/prototype/onboarding-new");
  await page.getByRole("button", { name: "View all tasks", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Onboarding tasks", exact: true })
    .getByRole("button", { name: /^ECS service/ })
    .click();
  const ecsIndex = await page.evaluate(
    () => JSON.parse(localStorage.getItem("atlas.onboarding-new.source.v4") ?? "{}").active,
  );

  for (const legacyPhase of ["waiting-repos", "running-repos", "repos-ready"]) {
    await page.evaluate(
      ({ active, phase }) => {
        localStorage.setItem(
          "atlas.onboarding-new.source.v4",
          JSON.stringify({
            active,
            completed: [0, 10, active],
            navigation: "expanded",
            values: {
              0: "DEMO",
              10: "123456789012",
              "scaffold:service_name": "checkout-api",
              "scaffold:stage": "preview",
              "journey:ecs-service:run-phase": phase,
            },
          }),
        );
      },
      { active: ecsIndex, phase: legacyPhase },
    );
    await page.reload();
    await expect(page.locator(".ecs-live-run")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Configure service", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Preview changes", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Preview changes", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible();
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("atlas.onboarding-new.source.v4") ?? "{}"),
    );
    expect(saved.values["journey:ecs-service:run-phase"]).toBe("");
    expect(saved.values["scaffold:stage"]).toBe("preview");
  }
});

test("missing repositories allow Preview but block PR creation and return to onboarding setup", async ({
  page,
}) => {
  await page.goto("/prototype/onboarding-new");
  await page.getByRole("button", { name: "View all tasks", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Onboarding tasks", exact: true })
    .getByRole("button", { name: /^ECS service/ })
    .click();
  const ecsIndex = await page.evaluate(
    () => JSON.parse(localStorage.getItem("atlas.onboarding-new.source.v4") ?? "{}").active,
  );
  await page.evaluate((active) => {
    localStorage.setItem(
      "atlas.onboarding-new.source.v4",
      JSON.stringify({
        active,
        completed: [0, 10],
        navigation: "expanded",
        values: {
          0: "DEMO",
          10: "123456789012",
          "scaffold:service_name": "checkout-api",
        },
      }),
    );
  }, ecsIndex);
  await page.reload();
  await page.getByRole("button", { name: "Preview changes", exact: true }).click();
  await expect(
    page.getByText("Infrastructure repository not confirmed", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview changes", exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Create infrastructure PR", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Authorize GitHub App", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create infrastructure PR", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Set up repositories", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Infrastructure repository: Repository" }),
  ).toBeVisible();
  await expect(page.locator(".on-task-body[aria-hidden='false'] h1")).not.toHaveText(
    "Configure service",
  );
});

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`deployment success preserves graph geometry and respects ${reducedMotion} motion`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/prototype/onboarding-new");
    await page.evaluate(() =>
      localStorage.setItem(
        "atlas.onboarding-new.source.v4",
        JSON.stringify({
          active: 15,
          completed: [0, 10],
          navigation: "expanded",
          values: {
            0: "DEMO",
            10: "123456789012",
            "scaffold:service_name": "checkout-api",
            "scaffold:stage": "run",
            "journey:ecs-service:run-phase": "deploying",
            "journey:ecs-service:completed:resources": "true",
            "journey:ecs-service:infra-run": "true",
            "journey:ecs-service:pr:infra": "simulated",
            "journey:ecs-service:pr:app": "simulated",
            "journey:ecs-service:pr-state:infra": "merged",
            "journey:ecs-service:pr-state:app": "merged",
          },
        }),
      ),
    );
    await page.reload();
    const run = page.locator(".ecs-live-run");
    await expect(run).toHaveAttribute("data-phase", "deploying");
    await expect(page.locator(".sa-execution .sa-paths")).toHaveCount(0);
    await expect(page.locator('.sa-node[data-node-id="ecs"]')).toHaveAttribute(
      "data-focused",
      "true",
    );
    await revealEcsDetails(page);
    await page.getByRole("button", { name: "Pause simulation", exact: true }).click();
    await expect(page.locator(".sa-endpoint-reveal")).toHaveAttribute("aria-hidden", "true");
    const graph = await page.locator(".sa-execution .sa-diagram").elementHandle();
    const frames = page.evaluate(
      () =>
        new Promise<{ height: number; x: number; y: number; highlight: number; wire: number }[]>(
          (resolve) => {
            const samples: {
              height: number;
              x: number;
              y: number;
              highlight: number;
              wire: number;
            }[] = [];
            const started = performance.now();
            function sample() {
              const endpoint = document
                .querySelector(".sa-endpoint-reveal")!
                .getBoundingClientRect();
              const diagram = document
                .querySelector(".sa-execution .sa-diagram")!
                .getBoundingClientRect();
              const highlight = Number(
                getComputedStyle(
                  document.querySelector('.sa-node[data-node-id="ecs"] .sa-resource-feedback')!,
                ).opacity,
              );
              const path = document.querySelector(".sa-execution .sa-paths path");
              const wire = path ? Number.parseFloat(getComputedStyle(path).strokeDashoffset) : 1;
              samples.push({
                height: endpoint.height,
                x: diagram.x,
                y: diagram.y,
                highlight,
                wire,
              });
              if (performance.now() - started < 1200) requestAnimationFrame(sample);
              else resolve(samples);
            }
            requestAnimationFrame(sample);
          },
        ),
    );
    await page.getByRole("button", { name: "Simulate successful run", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your service is ready" })).toBeVisible();
    const samples = await frames;
    const finalHeight = samples.at(-1)!.height;
    expect(finalHeight).toBeGreaterThan(100);
    expect(
      Math.max(...samples.map((s) => s.x)) - Math.min(...samples.map((s) => s.x)),
    ).toBeLessThan(1);
    expect(
      Math.max(...samples.map((s) => s.y)) - Math.min(...samples.map((s) => s.y)),
    ).toBeLessThan(1);
    expect(await graph?.evaluate((element) => element.isConnected)).toBe(true);
    if (reducedMotion === "no-preference") {
      expect(Math.max(...samples.map((s) => s.highlight))).toBeGreaterThan(0.2);
      expect(samples.filter((s) => s.wire > 0.01 && s.wire < 0.99).length).toBeGreaterThan(2);
      expect(
        samples.filter((s) => s.height > 1 && s.height < finalHeight - 1).length,
      ).toBeGreaterThan(2);
    } else {
      expect(samples.filter((s) => s.height > 1 && s.height < finalHeight - 1)).toHaveLength(0);
      expect(samples.every((s) => s.highlight === 0)).toBe(true);
      expect(samples.filter((s) => s.wire > 0.01 && s.wire < 0.99)).toHaveLength(0);
    }
    await expect(
      page.getByRole("button", { name: "Finish ECS journey", exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `/tmp/ecs-success-motion-${reducedMotion}.png`, fullPage: true });
  });
}
