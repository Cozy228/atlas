import { z } from "zod";
import onboarding from "../../../../../onboarding.json";

const definition = onboarding.find((journey) => journey.id === "ecs-service");
if (!definition) throw new Error("Missing ECS journey definition");
export const ecsJourney = definition;
const stageIdSchema = z.enum([
  "config",
  "preview",
  "result",
  "resources",
  "pipelines",
  "task-definition",
  "build",
  "run",
  "verify",
]);
const pipelineKindSchema = z.enum(["resources", "infra", "ci", "deploy"]);
const experienceSchema = z.object({
  pipelineSetup: z.array(z.object({ kind: pipelineKindSchema, label: z.string(), url: z.url() })),
  pipelineRuns: z.array(
    z.object({
      kind: pipelineKindSchema,
      stepId: z.string(),
      artifactId: z.string(),
      title: z.string(),
      instruction: z.string(),
      inputs: z.array(z.object({ key: z.string(), label: z.string(), source: z.string() })),
    }),
  ),
  steps: z
    .array(
      z.object({
        id: stageIdSchema,
        title: z.string(),
        sourceId: z.string(),
        outputs: z.array(z.string()),
        dependsOn: stageIdSchema.optional(),
      }),
    )
    .min(1),
});
const experience = experienceSchema.parse(
  "experience" in ecsJourney ? ecsJourney.experience : undefined,
);
export const ecsStages = experience.steps;
export const ecsPipelineSetup = experience.pipelineSetup;
export const ecsPipelineRuns = experience.pipelineRuns;
export type EcsStage = z.infer<typeof stageIdSchema>;
export function ecsStage(values: Record<string, string>): EcsStage {
  return ecsStages.find((stage) => stage.id === values["scaffold:stage"])?.id ?? "config";
}
export function ecsCompleted(values: Record<string, string>, stage: EcsStage) {
  return values[`journey:ecs-service:completed:${stage}`] === "true";
}
export const ecsProgress = (values: Record<string, string>) =>
  ecsStages.filter((stage) => ecsCompleted(values, stage.id)).length;

export const ecsArtifactStage = (artifactId: string) =>
  ecsStages.find((stage) => stage.outputs.includes(artifactId));
