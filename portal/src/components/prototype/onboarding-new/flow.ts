import type { ArtifactDefinition } from "./artifacts";
import onboarding from "../../../../../onboarding.json";

export type SourceStep = (typeof onboarding)[number]["steps"][number];
export type SourceBlock = NonNullable<SourceStep["content"]>["blocks"][number];
export type Task = {
  sourceId: string;
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
};
const sourceSteps = onboarding.flatMap<SourceStep>((journey) => journey.steps);
function sourceTask(sourceId: string): Task {
  const source = sourceSteps.find((step) => step.id === sourceId);
  if (!source) throw new Error(`Unknown onboarding source step: ${sourceId}`);
  const actionTask = source.tasks.flatMap((task) =>
    "capability" in task ? [{ title: task.title, link: task.capability.link }] : [],
  )[0];
  const action = actionTask?.link;
  const journey = onboarding.find((item) => item.steps[0].id === sourceId);
  const field = journey?.inputs.find((name) => !onboarding[0].inputs.includes(name)) ?? "";
  return {
    sourceId,
    presentation:
      "presentation" in source && source.presentation === "summary" ? "summary" : "task",
    inputs:
      onboarding.find((item) => item.steps.some((step) => step.id === sourceId))?.inputs ?? [],
    name: source.title,
    title: source.title,
    description: "",
    field,
    placeholder: field === "aws_account_id" ? "123456789012" : "",
    blocks: source.content?.blocks ?? [],
    action,
    actionLabel: actionTask?.title,
    required: source.tasks.some((task) => "required" in task && task.required),
    artifacts: "artifacts" in source ? source.artifacts : [],
  };
}
const applicationCode: Task = {
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
    name: "ECS deployment",
    tasks: [
      sourceTask("service-repos"),
      sourceTask("generate-stack"),
      sourceTask("infra-pipeline"),
      sourceTask("app-deploy-pipeline"),
      sourceTask("dev-deploy-success"),
      sourceTask("setup-summary"),
    ],
  },
];
export const tasks = phases.flatMap((phase, phaseIndex) =>
  phase.tasks.map((task) => ({ ...task, phaseIndex })),
);
export const phaseStart = (phaseIndex: number) =>
  phases.slice(0, phaseIndex).reduce((sum, phase) => sum + phase.tasks.length, 0);
export const STORAGE_KEY = "atlas.onboarding-new.source.v3";
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
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
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
    return { values, completed, active: raw.active, navigation };
  } catch {
    return initialProgress;
  }
}
