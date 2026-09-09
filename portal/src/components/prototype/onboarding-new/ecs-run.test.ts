import { expect, it } from "vitest";
import {
  allPrsMerged,
  executionPhase,
  executionPatch,
  nextExecutionPhase,
  prCreated,
  prState,
} from "./ecs-run";
import { ecsPipelineRuns, ecsStages } from "./ecs-journey";

it("requires explicit merge evidence for each PR", () => {
  expect(prState({}, "infra")).toBe("open");
  expect(allPrsMerged({})).toBe(false);
  const values = {
    "journey:ecs-service:pr-state:infra": "merged",
    "journey:ecs-service:pr-state:app": "open",
  };
  expect(allPrsMerged(values)).toBe(false);
  expect(allPrsMerged({ ...values, "journey:ecs-service:pr-state:app": "closed" })).toBe(false);
  expect(allPrsMerged({ ...values, "journey:ecs-service:pr-state:app": "merged" })).toBe(true);
});
it("represents the full infrastructure, task definition, CI and deploy sequence", () => {
  let phase = executionPhase("waiting-pr");
  const visited: string[] = [];
  while (phase) {
    visited.push(phase.id);
    phase = nextExecutionPhase(phase.id);
  }
  expect(visited).toEqual([
    "waiting-pr",
    "checking-pipeline",
    "waiting-tfe",
    "planning",
    "awaiting-apply",
    "applying",
    "task-definition",
    "waiting-app-pr",
    "waiting-resources",
    "running-resources",
    "waiting-ci",
    "building",
    "waiting-deploy",
    "deploying",
    "complete",
  ]);
  for (const id of [
    "waiting-pr",
    "task-definition",
    "waiting-app-pr",
    "waiting-resources",
    "checking-pipeline",
    "waiting-tfe",
    "awaiting-apply",
    "waiting-ci",
    "waiting-deploy",
  ])
    expect(executionPhase(id)?.duration).toBe(0);
  expect(executionPhase("applying")?.duration).toBeGreaterThanOrEqual(8000);
  expect(ecsStages.map((step) => step.id)).toEqual([
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
  expect(ecsPipelineRuns.map((run) => run.kind)).toEqual(["infra", "resources", "ci", "deploy"]);
  expect(nextExecutionPhase("unknown")).toBeUndefined();
});
it("only exposes outputs after their producing run succeeds", () => {
  const applying = executionPatch("applying", "checkout-api");
  expect(applying["journey:ecs-service:completed:pipelines"]).toBe("false");
  expect(applying["journey:ecs-service:output:taskRoleArn"]).toBeUndefined();
  const task = executionPatch("task-definition", "checkout-api", "123456789012");
  expect(task["journey:ecs-service:completed:pipelines"]).toBe("true");
  expect(task["journey:ecs-service:output:taskRoleArn"]).toBe(
    "arn:aws:iam::123456789012:role/checkout-api-task",
  );
  expect(task["artifact:task-definition:path"]).toBeUndefined();
  expect(task["artifact:ci-pipeline:image"]).toBeUndefined();
  const appPr = executionPatch("waiting-app-pr", "checkout-api", "123456789012");
  expect(prCreated(appPr, "infra")).toBe(true);
  expect(prCreated(appPr, "app")).toBe(true);
  expect(appPr["journey:ecs-service:pr-state:app"]).toBe("open");
  expect(appPr["artifact:task-definition:path"]).toBe("ecs/task-definition.json");
  expect(appPr["artifact:task-definition:taskRoleArn"]).toContain("checkout-api-task");
  const deploy = executionPatch("waiting-deploy", "checkout-api");
  expect(deploy["artifact:ci-pipeline:image"]).toBe("checkout-api:build-001");
  expect(deploy["journey:ecs-service:completed:run"]).toBe("false");
  const complete = executionPatch("complete", "checkout-api");
  expect(complete["journey:ecs-service:completed:run"]).toBe("true");
  expect(complete["journey:ecs-service:completed:verify"]).toBe("false");
  const restarted = executionPatch("waiting-pr", "checkout-api");
  expect(restarted["journey:ecs-service:pr-state:infra"]).toBe("open");
  expect(restarted["journey:ecs-service:pr:app"]).toBe("");
  expect(restarted["journey:ecs-service:pr-state:app"]).toBe("");
});
it("keeps self-service gates explicit and link-only actions inert", () => {
  const started = executionPatch("waiting-pr", "checkout-api");
  expect(started["artifact:infra-repository:repository"]).toBeUndefined();
  expect(started["artifact:app-repository:repository"]).toBeUndefined();
  const resources = executionPatch("waiting-resources", "checkout-api");
  expect(resources["journey:ecs-service:completed:result"]).toBe("true");
  expect(resources["journey:ecs-service:completed:resources"]).toBe("false");
  expect(resources["artifact:harness-resources-pipeline:url"]).toContain(
    "Create_Harness_Resources_For_AWS",
  );
});
