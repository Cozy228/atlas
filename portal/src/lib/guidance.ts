/**
 * Atlas Guidance — local route-guidance model and helpers.
 *
 * Mirrors the V1 design in `docs/product/guidance_design.md`: Guidance -> steps -> tasks,
 * rendered as a vertical stepper. The guidance manifests are served by the
 * guidance store (the single source of truth, validated by
 * `pnpm validate:guidance`) and fetched at runtime via `loadGuidance`
 * (server) -> `guidanceQueryOptions` -> route loaders, which pass the resolved
 * array into these helpers. No user progress is tracked; step status is computed
 * from the definition and the currently selected step only.
 */
import type { GuidanceBlock } from "@atlas/schema";

export type ScenarioFamily = "onboard" | "decide" | "enable" | "validate";

export type StepStatus = "available" | "selected";

export type GuidanceStatus = "draft" | "published" | "needs_review" | "deprecated";

export type ActionType =
  | "atlas_page"
  | "external_link"
  | "source_link"
  | "tool_link"
  | "support_link"
  | "copy_text";

export type GuidanceAction = {
  type: ActionType;
  label: string;
  /** atlas_page path, external/tool url, or support url. */
  target?: string;
  /** source registry id for source_link. */
  ref?: string;
  /** payload for copy_text. */
  text?: string;
};

export type GuidanceTask = {
  id: string;
  title: string;
  required?: boolean;
  action?: GuidanceAction;
  /** The `<h2>` sub-header this task groups under within its step (see @atlas/schema). */
  group?: string;
  /** The task's non-actionable detail (link-less sub-lists, prose, images). */
  detail?: ReadonlyArray<GuidanceBlock>;
  /** Nested checkable sub-tasks, mirroring a source list's actionable items. */
  subtasks?: ReadonlyArray<GuidanceTask>;
};

export type GuidanceStep = {
  id: string;
  title: string;
  description?: string;
  /** Why this step matters, shown above the task list. */
  why?: string;
  tasks?: ReadonlyArray<GuidanceTask>;
  /** `<h2>` sub-header groups within the step, carrying each cluster's description. */
  groups?: ReadonlyArray<{ label: string; description?: string }>;
  /** source registry ids cited by this step. */
  sources?: ReadonlyArray<string>;
  /** Structured content preserved from an authored source page (see @atlas/schema). */
  body?: ReadonlyArray<GuidanceBlock>;
};

export type Guidance = {
  id: string;
  title: string;
  scenario: string;
  family: ScenarioFamily;
  objective: string;
  destination: { title: string; description?: string };
  owner: { team: string; support: string };
  status: GuidanceStatus;
  version: string;
  lastReviewed: string;
  appliesTo?: {
    services?: ReadonlyArray<string>;
    landingZones?: ReadonlyArray<string>;
    securityPolicies?: ReadonlyArray<string>;
  };
  sources?: ReadonlyArray<string>;
  steps: ReadonlyArray<GuidanceStep>;
};

export const SCENARIO_FAMILIES: ReadonlyArray<{
  id: ScenarioFamily;
  label: string;
  description: string;
}> = [
  { id: "onboard", label: "Onboard", description: "Bring a new workload onto the platform." },
  { id: "decide", label: "Decide", description: "Choose between approved platform paths." },
  { id: "enable", label: "Enable", description: "Turn on an approved service or tool." },
  { id: "validate", label: "Validate", description: "Confirm readiness before production." },
];

export function listGuidance(guidances: ReadonlyArray<Guidance>): ReadonlyArray<Guidance> {
  return guidances;
}

export function getGuidance(guidances: ReadonlyArray<Guidance>, id: string): Guidance | undefined {
  return guidances.find((guidance) => guidance.id === id);
}

export function guidanceByFamily(guidances: ReadonlyArray<Guidance>): ReadonlyArray<{
  family: (typeof SCENARIO_FAMILIES)[number];
  items: ReadonlyArray<Guidance>;
}> {
  return SCENARIO_FAMILIES.map((family) => ({
    family,
    items: guidances.filter((guidance) => guidance.family === family.id),
  })).filter((group) => group.items.length > 0);
}

/** Guidance whose `appliesTo` references the given resource slug. */
export function relatedGuidanceForResource(
  guidances: ReadonlyArray<Guidance>,
  resourceSlug: string,
): ReadonlyArray<Guidance> {
  return guidances.filter((guidance) => {
    const applies = guidance.appliesTo;
    if (!applies) return false;
    return (
      (applies.services?.includes(resourceSlug) ?? false) ||
      (applies.landingZones?.includes(resourceSlug) ?? false) ||
      (applies.securityPolicies?.includes(resourceSlug) ?? false)
    );
  });
}

export function stepStatus(step: GuidanceStep, selectedStepId: string): StepStatus {
  return step.id === selectedStepId ? "selected" : "available";
}

/** First step a workspace should land on by default. */
export function defaultStepId(guidance: Guidance): string {
  return guidance.steps[0]?.id ?? "";
}
