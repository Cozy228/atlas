import { z } from "zod";
import { resolveTaskArtifacts } from "./artifacts";
import type { Progress, Task } from "./flow";

const inputSchema = z.object({
  key: z.string().regex(/^[a-z_]+$/),
  label: z.string().min(1),
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("input"), name: z.string() }),
    z.object({ kind: z.literal("context"), name: z.string() }),
    z.object({ kind: z.literal("artifact"), artifact: z.string(), field: z.string() }),
  ]),
});
const draftShape = {
  id: z.string().min(1),
  label: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  inputs: z.array(inputSchema),
};
export const guidanceSchema = z
  .array(
    z.discriminatedUnion("kind", [
      z.object({ ...draftShape, kind: z.literal("email"), recipient: z.email() }),
      z.object({ ...draftShape, kind: z.literal("copy") }),
    ]),
  )
  .superRefine((actions, context) => {
    for (const action of actions) {
      const keys = action.inputs.map((input) => input.key);
      if (new Set(keys).size !== keys.length) {
        context.addIssue({ code: "custom", message: `Duplicate inputs in ${action.id}` });
      }
      for (const match of `${action.subject}\n${action.body}`.matchAll(/\{\{([a-z_]+)\}\}/g)) {
        if (!keys.includes(match[1])) {
          context.addIssue({
            code: "custom",
            message: `Unknown binding ${match[1]} in ${action.id}`,
          });
        }
      }
    }
  });
export type GuidanceAction = z.infer<typeof guidanceSchema>[number];

export function resolveGuidance(action: GuidanceAction, tasks: Task[], progress: Progress) {
  const inputs = action.inputs.map((input) => {
    const source = input.source;
    switch (source.kind) {
      case "context": {
        const storageKey = `guidance:context:${source.name}`;
        return {
          ...input,
          storageKey,
          value: progress.values[storageKey]?.trim() ?? "",
          taskIndex: -1,
        };
      }
      case "input": {
        const taskIndex = tasks.findIndex((task) => task.field === source.name);
        return {
          ...input,
          storageKey: "",
          value: progress.values[taskIndex]?.trim() ?? "",
          taskIndex,
        };
      }
      case "artifact": {
        const taskIndex = tasks.findIndex((task) =>
          task.artifacts.some((artifact) => artifact.id === source.artifact),
        );
        const artifact =
          taskIndex >= 0 &&
          (taskIndex === progress.active || progress.completed.includes(taskIndex))
            ? resolveTaskArtifacts(tasks, progress, taskIndex).find(
                (item) => item.id === source.artifact,
              )
            : undefined;
        const fields =
          artifact?.fields.filter((field) => source.field === "*" || field.key === source.field) ??
          [];
        const value =
          fields.length > 0 && fields.every((field) => field.value.trim())
            ? fields.map((field) => field.value.trim()).join("\n")
            : "";
        return { ...input, storageKey: "", value, taskIndex };
      }
    }
  });
  function render(template: string) {
    return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => {
      const input = inputs.find((item) => item.key === key);
      return input?.value || `[REPLACE: ${input?.label ?? key}]`;
    });
  }
  const subject = render(action.subject).replace(/[\r\n]+/g, " ");
  const body = render(action.body);
  const missing = inputs.filter((input) => !input.value);
  const text = `${action.kind === "email" ? `To: ${action.recipient}\n` : ""}Subject: ${subject}\n\n${body}`;
  const href =
    action.kind === "email"
      ? `mailto:${action.recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      : undefined;
  return { inputs, subject, body, missing, text, href };
}
