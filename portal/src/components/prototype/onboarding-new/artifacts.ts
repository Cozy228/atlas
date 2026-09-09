import { formatSourceText } from "./source-text";
import type { Progress, Task } from "./flow";

export function artifactUrl(value: string | undefined) {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export type ArtifactDefinition = {
  id: string;
  name: string;
  group: string;
  primary: string;
  link: string;
  fields: { key: string; label: string; value: string; editable: boolean }[];
};

export function resolveTaskArtifacts(tasks: Task[], progress: Progress, index: number) {
  const applicationCode = progress.values[0] ?? "";
  return tasks[index].artifacts.map((artifact) => {
    const fields = artifact.fields.map((field) => {
      const storageKey =
        artifact.id === "application-code"
          ? "0"
          : artifact.id === "aws-account" && field.key === "account"
            ? String(tasks.findIndex((item) => item.field === "aws_account_id"))
            : `artifact:${artifact.id}:${field.key}`;
      const template =
        applicationCode || !field.value.includes("<app_code>")
          ? formatSourceText(field.value, applicationCode)
          : "";
      return { ...field, storageKey, value: progress.values[storageKey] ?? template };
    });
    const url = fields.find((field) => field.key === artifact.link)?.value.trim();
    const link = artifactUrl(url);
    const value = fields.find((field) => field.key === artifact.primary)?.value ?? "";
    return {
      ...artifact,
      index,
      fields,
      value,
      link,
      searchText: fields.map((field) => field.value).join(" "),
    };
  });
}

export function collectArtifacts(tasks: Task[], progress: Progress) {
  return tasks.flatMap((_, index) =>
    progress.completed.includes(index) || tasks[index].journeyRef === "ecs-service"
      ? resolveTaskArtifacts(tasks, progress, index).filter(
          (artifact) => artifact.value.trim() && (artifact.primary !== "url" || !!artifact.link),
        )
      : [],
  );
}
