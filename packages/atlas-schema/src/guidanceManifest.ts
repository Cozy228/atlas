/**
 * Guidance manifest validation — the shared gate used by both the CLI
 * (`pnpm validate:guidance`) and the CI test. Pure and fs-free: callers parse
 * YAML/JSON and pass the plain object in, so this stays portable and testable.
 *
 * Two tiers, matching the governed-honesty model:
 *   - errors   — schema violations; block import.
 *   - warnings — governance smells that need human judgement, not rejection
 *     (e.g. an action label that implies Atlas executed work). Surfaced, not
 *     fatal, so authors and reviewers see them in the PR.
 */
import { GuidanceSchema, type Guidance } from "./index.js";

export type ManifestIssue = {
  level: "error" | "warning";
  path: string;
  message: string;
};

export type GuidanceValidation = {
  guidance?: Guidance;
  issues: ManifestIssue[];
};

/**
 * Verbs that imply Atlas performed work on an external system. Guidance is
 * wayfinding only (guidance_design §5.9) — action labels should read
 * Open/View/Copy/Contact. A hit is a warning, not an error: wording is a human
 * call, and false positives (e.g. "Run the first promoted deploy" describing a
 * user action) shouldn't block import.
 */
const EXECUTION_VERBS = [
  "submit",
  "apply",
  "provision",
  "terraform apply",
  "deploy to",
];

export function validateGuidanceDocument(
  raw: unknown,
  file = "<guidance>",
): GuidanceValidation {
  const parsed = GuidanceSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      level: "error" as const,
      path: `${file}:${issue.path.join(".") || "<root>"}`,
      message: issue.message,
    }));
    return { issues };
  }

  const guidance = parsed.data;
  const issues: ManifestIssue[] = [];

  // Duplicate step / task ids would make selection ambiguous in the renderer.
  const stepIds = new Set<string>();
  for (const step of guidance.steps) {
    if (stepIds.has(step.id)) {
      issues.push({
        level: "error",
        path: `${file}:steps.${step.id}`,
        message: `duplicate step id "${step.id}"`,
      });
    }
    stepIds.add(step.id);

    const taskIds = new Set<string>();
    for (const task of step.tasks ?? []) {
      if (taskIds.has(task.id)) {
        issues.push({
          level: "error",
          path: `${file}:steps.${step.id}.tasks.${task.id}`,
          message: `duplicate task id "${task.id}"`,
        });
      }
      taskIds.add(task.id);

      const label = task.action?.label?.toLowerCase();
      if (label) {
        const verb = EXECUTION_VERBS.find((v) => label.startsWith(v) || label.includes(` ${v} `));
        if (verb) {
          issues.push({
            level: "warning",
            path: `${file}:steps.${step.id}.tasks.${task.id}.action.label`,
            message: `action label "${task.action?.label}" implies Atlas executes work ("${verb}") — prefer Open/View/Copy/Contact`,
          });
        }
      }
    }
  }

  return { guidance, issues };
}

/**
 * Validate a set of already-parsed guidance documents and check cross-file
 * invariants (unique guidance ids). `docs` is keyed by file path for messages.
 */
export function validateGuidanceManifest(
  docs: ReadonlyArray<{ file: string; raw: unknown }>,
): { guidances: Guidance[]; issues: ManifestIssue[] } {
  const issues: ManifestIssue[] = [];
  const guidances: Guidance[] = [];
  const seenIds = new Map<string, string>();

  for (const { file, raw } of docs) {
    const result = validateGuidanceDocument(raw, file);
    issues.push(...result.issues);
    if (!result.guidance) continue;

    const prior = seenIds.get(result.guidance.id);
    if (prior) {
      issues.push({
        level: "error",
        path: `${file}:id`,
        message: `duplicate guidance id "${result.guidance.id}" (also in ${prior})`,
      });
    } else {
      seenIds.set(result.guidance.id, file);
      guidances.push(result.guidance);
    }
  }

  return { guidances, issues };
}
