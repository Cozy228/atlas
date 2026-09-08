import { afterEach, describe, expect, it, vi } from "vitest";
import onboarding from "../../../../../onboarding.json";
import { initialProgress, markComplete, phases, readProgress, tasks } from "./flow";

afterEach(() => vi.unstubAllGlobals());
function stored(value: unknown) {
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(value) });
}
describe("source-driven onboarding", () => {
  it("covers each source task once across six phases", () => {
    const expected = onboarding.flatMap((journey) =>
      journey.steps.filter((step) => step.tasks.length).map((step) => step.id),
    );
    expect(phases).toHaveLength(6);
    expect(
      tasks
        .slice(1)
        .map((task) => task.sourceId)
        .sort(),
    ).toEqual(expected.sort());
    expect(tasks).toHaveLength(expected.length + 1);
    expect(tasks[0].field).toBe(onboarding[0].inputs[0]);
    expect(tasks.slice(1).every((task) => task.blocks.length)).toBe(true);
    expect(tasks.filter((task) => task.field).map((task) => task.field)).toEqual([
      "app_code",
      "aws_account_id",
    ]);
    expect(tasks.find((task) => task.sourceId === "service-repos")?.field).toBe("aws_account_id");
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
  const active = tasks.findIndex((task) => task.sourceId === "generate-stack");
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
