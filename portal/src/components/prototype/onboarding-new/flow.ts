import { executionPatch, runPhaseKey } from "./ecs-run";
import { guidanceSchema, type GuidanceAction } from "./guidance";
import type { ArtifactDefinition } from "./artifacts";
import onboarding from "../../../../../onboarding.json";

export type SourceStep = (typeof onboarding)[number]["steps"][number];
export type SourceBlock = NonNullable<SourceStep["content"]>["blocks"][number];
export type Task = {
  sourceId: string;
  journeyRef?: string;
  name: string;
  title: string;
  description: string;
  field: string;
  placeholder: string;
  blocks: SourceBlock[];
  action?: string;
  actionLabel?: string;
  required: boolean;
  inputs: string[];
  presentation: "task" | "summary";
  artifacts: ArtifactDefinition[];
  guidance: GuidanceAction[];
};
const sourceSteps = onboarding.flatMap<SourceStep>((journey) => journey.steps);
function sourceTask(sourceId: string): Task {
  const source = sourceSteps.find((step) => step.id === sourceId);
  if (!source) throw new Error(`Unknown onboarding source step: ${sourceId}`);
  const actionTask = source.tasks.flatMap((task) =>
    "capability" in task && task.capability
      ? [{ title: task.title, link: task.capability.link }]
      : [],
  )[0];
  const action = actionTask?.link;
  const journey = onboarding.find((item) => item.steps[0].id === sourceId);
  const field =
    sourceId === "aws-account"
      ? "aws_account_id"
      : (journey?.inputs.find((name) => !onboarding[0].inputs.includes(name)) ?? "");
  return {
    sourceId,
    journeyRef: "journeyRef" in source ? source.journeyRef : undefined,
    guidance: guidanceSchema.parse("guidance" in source ? source.guidance : []),
    presentation:
      "presentation" in source && source.presentation === "summary" ? "summary" : "task",
    inputs:
      onboarding.find((item) =>
        "journeyRef" in source
          ? item.id === source.journeyRef
          : item.steps.some((step) => step.id === sourceId),
      )?.inputs ?? [],
    name: source.title,
    title: source.title,
    description: "",
    field,
    placeholder: field === "aws_account_id" ? "123456789012" : "",
    blocks: source.content?.blocks ?? [],
    action,
    actionLabel: actionTask?.title,
    required: source.tasks.some((task) => "required" in task && task.required),
    artifacts:
      "journeyRef" in source
        ? onboarding
            .filter((journey) => journey.id === source.journeyRef)
            .flatMap((journey) =>
              journey.steps.flatMap((step) => ("artifacts" in step ? step.artifacts : [])),
            )
        : "artifacts" in source
          ? source.artifacts
          : [],
  };
}
const applicationCode: Task = {
  guidance: [],
  artifacts: [
    {
      id: "application-code",
      name: "Application code",
      group: "Accounts & values",
      primary: "code",
      link: "",
      fields: [{ key: "code", label: "Application code", value: "", editable: true }],
    },
  ],
  sourceId: "application-code",
  presentation: "task",
  inputs: [],
  name: "Application code",
  title: "Confirm application code",
  description: onboarding[0].objective,
  field: onboarding[0].inputs[0],
  placeholder: "APP1",
  blocks: [],
  required: true,
};
export const phases = [
  {
    name: "Identity & access",
    tasks: [applicationCode, sourceTask("sailpoint-groups"), sourceTask("group-mapping")],
  },
  {
    name: "Code & projects",
    tasks: [sourceTask("harness-onboarding"), sourceTask("git-onboarding")],
  },
  {
    name: "Terraform",
    tasks: [sourceTask("tfe-access"), sourceTask("tfe-project"), sourceTask("tfe-workspace")],
  },
  {
    name: "AWS account",
    tasks: [
      sourceTask("aws-email-dl"),
      sourceTask("aws-group-mapping"),
      sourceTask("aws-account"),
      sourceTask("aws-connector"),
    ],
  },
  {
    name: "Privileged access",
    tasks: [sourceTask("vault-unix"), sourceTask("cyberark-groups"), sourceTask("cyberark-role")],
  },
  {
    name: "ECS service",
    tasks: [sourceTask("launch-ecs")],
  },
];
export const sections = [
  ...phases,
  { name: "Summary & support", tasks: [sourceTask("setup-summary")] },
];
export const tasks = sections.flatMap((phase, phaseIndex) =>
  phase.tasks.map((task) => ({ ...task, phaseIndex })),
);
export const phaseStart = (phaseIndex: number) =>
  sections.slice(0, phaseIndex).reduce((sum, phase) => sum + phase.tasks.length, 0);
export const STORAGE_KEY = "atlas.onboarding-new.source.v4";
export type Progress = {
  values: Record<string, string>;
  completed: number[];
  active: number;
  navigation: "hidden" | "expanded" | "collapsed";
};
export const initialProgress: Progress = {
  values: {},
  completed: [],
  active: 0,
  navigation: "hidden",
};
export function inputDependencies(progress: Progress) {
  const task = tasks[progress.active];
  return task.inputs
    .filter((field) => field !== task.field)
    .map((field) => {
      const index = tasks.findIndex((item) => item.field === field);
      return {
        field,
        index,
        confirmed: progress.completed.includes(index) && !!progress.values[index]?.trim(),
      };
    });
}
export function markComplete(progress: Progress): Progress {
  return {
    ...progress,
    navigation: progress.navigation === "hidden" ? "expanded" : progress.navigation,
    completed: [...new Set([...progress.completed, progress.active])],
    active: Math.min(progress.active + 1, tasks.length - 1),
  };
}
export function readProgress(): Progress {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const raw: unknown = JSON.parse(
      current ?? localStorage.getItem("atlas.onboarding-new.source.v3") ?? "null",
    );
    if (
      !current &&
      raw &&
      typeof raw === "object" &&
      "active" in raw &&
      typeof raw.active === "number" &&
      "completed" in raw &&
      Array.isArray(raw.completed) &&
      "values" in raw &&
      raw.values &&
      typeof raw.values === "object"
    ) {
      const legacyActive = raw.active;
      const legacyCompleted = raw.completed;
      const legacyStage =
        legacyActive === 17 || legacyActive === 18
          ? "pipelines"
          : legacyActive === 19
            ? "verify"
            : undefined;
      Object.assign(raw.values, {
        "journey:ecs-service:open": legacyActive >= 15 && legacyActive <= 19 ? "true" : "false",
      });
      if (legacyStage) Object.assign(raw.values, { "scaffold:stage": legacyStage });
      if (legacyCompleted.includes(15))
        Object.assign(raw.values, { "journey:ecs-service:completed:config": "true" });
      if (legacyCompleted.includes(16))
        Object.assign(raw.values, {
          "journey:ecs-service:completed:preview": "true",
          "journey:ecs-service:completed:result": "true",
        });
      if (legacyCompleted.includes(17) && legacyCompleted.includes(18))
        Object.assign(raw.values, { "journey:ecs-service:completed:pipelines": "true" });
      if (legacyCompleted.includes(19))
        Object.assign(raw.values, {
          "journey:ecs-service:completed:run": "true",
          "journey:ecs-service:completed:verify": "true",
        });
      raw.active = legacyActive >= 20 ? 16 : legacyActive >= 15 ? 15 : legacyActive;
      raw.completed = [
        ...legacyCompleted.filter((index) => typeof index === "number" && index < 15),
        ...([15, 16, 17, 18, 19].every((index) => legacyCompleted.includes(index)) ? [15] : []),
        ...(legacyCompleted.includes(20) ? [16] : []),
      ];
    }
    if (
      !raw ||
      typeof raw !== "object" ||
      !("values" in raw) ||
      !("completed" in raw) ||
      !("active" in raw)
    )
      return initialProgress;
    if (
      typeof raw.values !== "object" ||
      raw.values === null ||
      Array.isArray(raw.values) ||
      typeof raw.active !== "number" ||
      !Number.isInteger(raw.active) ||
      raw.active < 0 ||
      raw.active >= tasks.length ||
      !Array.isArray(raw.completed)
    )
      return initialProgress;
    const completed: number[] = [];
    for (const index of raw.completed) {
      if (
        typeof index !== "number" ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= tasks.length
      )
        return initialProgress;
      if (!completed.includes(index)) completed.push(index);
    }
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(raw.values)) {
      if (typeof value !== "string") return initialProgress;
      values[key] = value;
    }
    const navigation =
      "navigation" in raw
        ? raw.navigation
        : "collapsed" in raw && typeof raw.collapsed === "boolean"
          ? raw.collapsed
            ? "collapsed"
            : completed.length > 0 || raw.active > 0
              ? "expanded"
              : "hidden"
          : "hidden";
    if (navigation !== "hidden" && navigation !== "expanded" && navigation !== "collapsed")
      return initialProgress;
    if (["waiting-repos", "running-repos", "repos-ready"].includes(values[runPhaseKey])) {
      values[runPhaseKey] = "";
      values["scaffold:stage"] = "config";
      return {
        values,
        completed: completed.filter((index) => tasks[index].journeyRef !== "ecs-service"),
        active: raw.active,
        navigation,
      };
    }
    if (values[runPhaseKey] && !values["journey:ecs-service:pr-state:infra"]) {
      Object.assign(
        values,
        executionPatch("waiting-pr", values["scaffold:service_name"] || "service"),
      );
      return {
        values,
        completed: completed.filter((index) => tasks[index].journeyRef !== "ecs-service"),
        active: raw.active,
        navigation,
      };
    }
    return { values, completed, active: raw.active, navigation };
  } catch {
    return initialProgress;
  }
}
