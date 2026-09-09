import { expect, it } from "vitest";
import { artifactUrl, collectArtifacts } from "./artifacts";
import { ecsArtifactStage, ecsStages } from "./ecs-journey";
import { initialProgress, tasks } from "./flow";
it("keeps ECS outputs available before the parent journey is complete", () => {
  const index = tasks.findIndex((task) => task.journeyRef === "ecs-service");
  const resources = collectArtifacts(tasks, {
    ...initialProgress,
    values: {
      "artifact:infra-pr:url": "https://git.example.com/demo/pull/1",
      "artifact:app-pr:url": "https://",
    },
  });
  expect(resources.map((resource) => resource.id)).toEqual(["infra-pr"]);
  expect(resources[0]?.index).toBe(index);
  expect(ecsArtifactStage("infra-pr")?.id).toBe("result");
  expect(ecsArtifactStage("app-pr")?.id).toBe("task-definition");
  expect(ecsArtifactStage("app-pipeline")?.id).toBe("run");
  expect(ecsStages).toHaveLength(9);
});

it("models infrastructure before application PR and Harness resources", () => {
  expect(ecsStages.map((stage) => stage.id)).toEqual([
    "config",
    "preview",
    "result",
    "pipelines",
    "task-definition",
    "resources",
    "build",
    "run",
    "verify",
  ]);
  expect(ecsStages.map((stage) => stage.dependsOn)).toEqual([
    undefined,
    "config",
    "preview",
    "result",
    "pipelines",
    "task-definition",
    "resources",
    "build",
    "run",
  ]);
  expect(ecsStages.find((stage) => stage.id === "result")?.title).toBe("Infrastructure PR");
  expect(ecsStages.find((stage) => stage.id === "task-definition")?.title).toBe("Application PR");
});
it("receives repositories from onboarding instead of creating them in ECS", () => {
  const setup = tasks.find(
    (task) =>
      !task.journeyRef && task.artifacts.some((artifact) => artifact.id === "infra-repository"),
  );
  expect(setup).toBeDefined();
  expect(setup?.artifacts.map((artifact) => artifact.id)).toContain("app-repository");
  expect(ecsArtifactStage("infra-repository")).toBeUndefined();
  expect(ecsArtifactStage("app-repository")).toBeUndefined();
});
it("only opens complete HTTP links", () => {
  expect(artifactUrl("https://")).toBeUndefined();
  expect(artifactUrl("javascript:alert(1)")).toBeUndefined();
  expect(artifactUrl("https://harness.example.com/run/1")).toBe(
    "https://harness.example.com/run/1",
  );
});
