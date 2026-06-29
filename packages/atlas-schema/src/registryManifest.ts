/**
 * Registry manifest validation — the shared gate used by both the CLI
 * (`pnpm validate:registry`) and the Context Layer loader. Pure and fs-free,
 * mirroring `guidanceManifest.ts`: callers parse YAML/JSON and pass the plain
 * objects in, so this stays portable and testable.
 *
 * Scope: the registry object kinds the seed uses — Sources, Topics, and
 * Source↔Topic mappings. New contracts (mapping severity, …) belong to later
 * legs and are intentionally not modelled here.
 *
 * Errors block import; there are no warning-tier checks for registry objects
 * today (the governance warnings live in the guidance gate).
 */
import {
  SourceSchema,
  SourceTopicMappingSchema,
  TopicSchema,
  type Source,
  type SourceTopicMapping,
  type Topic,
} from "./index";
import type { ManifestIssue } from "./guidanceManifest";
import type { z } from "zod";

export type DocumentValidation<T> = {
  value?: T;
  issues: ManifestIssue[];
};

/** Validate a single record against a schema and map zod errors to issues. */
function validateDocument<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  file: string,
): DocumentValidation<z.infer<S>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      level: "error" as const,
      path: `${file}:${issue.path.join(".") || "<root>"}`,
      message: issue.message,
    }));
    return { issues };
  }
  return { value: parsed.data, issues: [] };
}

export const validateSourceDocument = (raw: unknown, file = "<source>") =>
  validateDocument(SourceSchema, raw, file);
export const validateTopicDocument = (raw: unknown, file = "<topic>") =>
  validateDocument(TopicSchema, raw, file);
export const validateMappingDocument = (raw: unknown, file = "<mapping>") =>
  validateDocument(SourceTopicMappingSchema, raw, file);

/** Validate an array of records, dropping duplicates by id, collecting issues. */
function collect<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  file: string,
  kind: string,
  issues: ManifestIssue[],
): Array<z.infer<S>> {
  const out: Array<z.infer<S>> = [];
  if (!Array.isArray(raw)) {
    issues.push({
      level: "error",
      path: `${file}:<root>`,
      message: `expected an array of ${kind} records`,
    });
    return out;
  }

  const seen = new Set<string>();
  raw.forEach((record, index) => {
    const idHint =
      record && typeof record === "object" && "id" in record
        ? String((record as { id: unknown }).id)
        : `[${index}]`;
    const result = validateDocument(schema, record, `${file}:${idHint}`);
    if (!result.value) {
      issues.push(...result.issues);
      return;
    }

    // Every registry schema has a string `id`; the generic can't prove it.
    const id = (result.value as unknown as { id: string }).id;
    if (seen.has(id)) {
      issues.push({
        level: "error",
        path: `${file}:${id}`,
        message: `duplicate ${kind} id "${id}"`,
      });
      return;
    }
    seen.add(id);
    out.push(result.value);
  });

  return out;
}

export type RegistryManifestInput = {
  sources: unknown;
  topics: unknown;
  mappings: unknown;
};

export type RegistryManifestValidation = {
  sources: Source[];
  topics: Topic[];
  mappings: SourceTopicMapping[];
  issues: ManifestIssue[];
};

/**
 * Validate a full set of already-parsed registry documents and check cross-file
 * invariants: duplicate ids per kind, and dangling references (mapping → source
 * / topic). Returns the validated entities plus all issues.
 */
export function validateRegistryManifest(input: RegistryManifestInput): RegistryManifestValidation {
  const issues: ManifestIssue[] = [];

  const sources = collect(SourceSchema, input.sources, "sources.yaml", "source", issues);
  const topics = collect(TopicSchema, input.topics, "topics.yaml", "topic", issues);
  const mappings = collect(
    SourceTopicMappingSchema,
    input.mappings,
    "source-topic-mappings.yaml",
    "mapping",
    issues,
  );

  const sourceIds = new Set(sources.map((source) => source.id));
  const topicIds = new Set(topics.map((topic) => topic.id));

  for (const mapping of mappings) {
    if (!sourceIds.has(mapping.source_id)) {
      issues.push({
        level: "error",
        path: `source-topic-mappings.yaml:${mapping.id}.source_id`,
        message: `dangling source_id "${mapping.source_id}" (no such source)`,
      });
    }
    if (!topicIds.has(mapping.topic_id)) {
      issues.push({
        level: "error",
        path: `source-topic-mappings.yaml:${mapping.id}.topic_id`,
        message: `dangling topic_id "${mapping.topic_id}" (no such topic)`,
      });
    }
  }

  return { sources, topics, mappings, issues };
}
