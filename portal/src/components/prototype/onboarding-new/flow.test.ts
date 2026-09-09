import { afterEach, describe, expect, it, vi } from "vitest";
import onboarding from "../../../../../onboarding.json";
import { initialProgress, markComplete, phases, readProgress, tasks } from "./flow";

afterEach(() => vi.unstubAllGlobals());
function stored(value: unknown) {
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(value) });
}
it("returns legacy repository setup runs to ECS configuration without losing parent outputs", () => {
  const active = tasks.findIndex((task) => task.journeyRef === "ecs-service");
  stored({
    active,
    completed: [],
    navigation: "expanded",
    values: {
      "scaffold:stage": "repos",
      "journey:ecs-service:run-phase": "waiting-repos",
      "artifact:infra-repository:repository": "checkout-infra",
    },
  });
  const restored = readProgress();
  expect(restored.values["scaffold:stage"]).toBe("config");
  expect(restored.values["journey:ecs-service:run-phase"]).toBe("");
  expect(restored.values["artifact:infra-repository:repository"]).toBe("checkout-infra");
});
describe("source-driven onboarding", () => {
  it("covers each source task once across six phases", () => {
    const expected = onboarding
      .filter((journey) => journey.id !== "ecs-service")
      .flatMap((journey) => journey.steps.map((step) => step.id));
    expect(phases).toHaveLength(6);
    expect(
      tasks
        .slice(1)
        .map((task) => task.sourceId)
        .sort(),
    ).toEqual(expected.sort());
    expect(tasks).toHaveLength(expected.length + 1);
    expect(tasks[0].field).toBe(onboarding[0].inputs[0]);
    expect(tasks.slice(1).every((task) => task.blocks.length || task.journeyRef)).toBe(true);
    expect(tasks.filter((task) => task.field).map((task) => task.field)).toEqual([
      "app_code",
      "aws_account_id",
    ]);
    expect(tasks.find((task) => task.sourceId === "launch-ecs")?.journeyRef).toBe("ecs-service");
  });
  it("restores a future task without claiming earlier tasks were completed", () => {
    const saved = { values: { 0: "APP1" }, completed: [0], active: 12, collapsed: true };
    stored(saved);
    expect(readProgress()).toEqual({
      values: saved.values,
      completed: saved.completed,
      active: saved.active,
      navigation: "collapsed",
    });
  });
  it("marks only the selected task complete after a jump", () => {
    const result = markComplete({ ...initialProgress, completed: [0], active: 12 });
    expect(result.completed).toEqual([0, 12]);
    expect(result.active).toBe(13);
  });
  it("does not double count a completed task", () => {
    expect(markComplete({ ...initialProgress, completed: [0], active: 0 }).completed).toEqual([0]);
  });
  it.each([-1, tasks.length, 1.5])("rejects an out-of-range task %s", (active) => {
    stored({ values: {}, completed: [], active, collapsed: false });
    expect(readProgress()).toEqual(initialProgress);
  });
  it("recovers when storage is unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Storage denied");
      },
    });
    expect(readProgress()).toEqual(initialProgress);
  });
});

it("derives input dependency status from both saved values and completion", async () => {
  const { inputDependencies } = await import("./flow");
  const active = tasks.findIndex((task) => task.sourceId === "launch-ecs");
  const accountIndex = tasks.findIndex((task) => task.field === "aws_account_id");
  const progress = {
    ...initialProgress,
    active,
    completed: [0, accountIndex],
    values: { 0: "APP1", [accountIndex]: "123456789012" },
  };
  expect(inputDependencies(progress).map((input) => input.confirmed)).toEqual([true, true]);
  expect(
    inputDependencies({ ...progress, completed: [0] }).map((input) => input.confirmed),
  ).toEqual([true, false]);
  expect(markComplete({ ...progress, completed: [] }).completed).toEqual([active]);
});

describe("navigation visibility", () => {
  it("starts hidden and remains expanded after viewing tasks and returning to the first task", () => {
    expect(initialProgress.navigation).toBe("hidden");
    stored({ ...initialProgress, navigation: "expanded", active: 0 });
    expect(readProgress().navigation).toBe("expanded");
  });
  it("restores a collapsed navigation before any task is completed", () => {
    stored({ ...initialProgress, navigation: "collapsed" });
    expect(readProgress().navigation).toBe("collapsed");
  });
  it("reveals navigation on first completion and preserves an existing collapsed state", () => {
    expect(markComplete(initialProgress).navigation).toBe("expanded");
    expect(markComplete({ ...initialProgress, navigation: "collapsed" }).navigation).toBe(
      "collapsed",
    );
  });
});

it("keeps onboarding summary separate from the atomic ECS journey", () => {
  expect(phases[5].tasks).toHaveLength(1);
  expect(
    phases.flatMap((phase) => phase.tasks).some((task) => task.presentation === "summary"),
  ).toBe(false);
  expect(tasks.at(-1)?.sourceId).toBe("setup-summary");
  const ecs = onboarding.find((journey) => journey.id === "ecs-service");
  expect(ecs?.steps.map((step) => step.id)).toEqual([
    "generate-stack",
    "infra-pipeline",
    "update-task-definition",
    "app-ci-pipeline",
    "app-deploy-pipeline",
    "dev-deploy-success",
  ]);
});

it("migrates legacy child task progress into the nested journey without completing the parent", () => {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) =>
      key.endsWith("v3")
        ? JSON.stringify({
            active: 18,
            completed: [0, 10, 15, 16],
            values: {
              0: "APP1",
              10: "123456789012",
              "artifact:infra-pipeline:url": "https://harness.example.com/pipeline/infra",
            },
            navigation: "expanded",
          })
        : null,
  });
  const restored = readProgress();
  expect(restored.active).toBe(15);
  expect(restored.completed).toEqual([0, 10]);
  expect(restored.values["scaffold:stage"]).toBe("pipelines");
  expect(restored.values["journey:ecs-service:completed:result"]).toBe("true");
  expect(restored.values["artifact:infra-pipeline:url"]).toContain("/infra");
});

it("does not restore a legacy simulated completion as merged PR evidence", () => {
  stored({
    active: 15,
    completed: [0, 15],
    navigation: "expanded",
    values: {
      "scaffold:service_name": "catalog-api",
      "scaffold:stage": "verify",
      "journey:ecs-service:run-phase": "complete",
    },
  });
  const restored = readProgress();
  expect(restored.values["journey:ecs-service:run-phase"]).toBe("waiting-pr");
  expect(restored.values["journey:ecs-service:pr-state:infra"]).toBe("open");
  expect(restored.completed).toEqual([0]);
});
