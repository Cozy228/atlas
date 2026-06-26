/**
 * Atlas Guidance — local route-guidance model and helpers.
 *
 * Mirrors the V1 design in `docs/product/guidance_design.md`: Guidance -> steps -> tasks,
 * rendered as a vertical stepper. The guidance definitions live in
 * `data/guidance/*.yaml` (the single source of truth, validated by
 * `pnpm validate:guidance`) and are loaded at runtime via `loadGuidance`
 * (server) -> `guidanceQueryOptions` -> route loaders, which pass the resolved
 * array into these helpers. No user progress is tracked; step status is computed
 * from the definition and the currently selected step only.
 */
export type GuidanceType = "route" | "decision" | "checklist";

export type ScenarioFamily = "onboard" | "decide" | "enable" | "validate";

export type StepKind = "action" | "decision" | "checklist" | "support" | "destination";

export type StepStatus = "available" | "selected" | "blocked" | "needs_support" | "destination";

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
};

export type DecisionOption = {
  id: string;
  title: string;
  description?: string;
  /** atlas_page path the option routes to. */
  to?: string;
};

export type GuidanceStep = {
  id: string;
  title: string;
  kind: StepKind;
  description?: string;
  /** Why this step matters, shown above the task list. */
  why?: string;
  tasks?: ReadonlyArray<GuidanceTask>;
  /** source registry ids cited by this step. */
  sources?: ReadonlyArray<string>;
  support?: { team: string; channel: string };
  /** decision step branch options. */
  options?: ReadonlyArray<DecisionOption>;
  /** intrinsic marker independent of selection. */
  marker?: Extract<StepStatus, "blocked" | "needs_support">;
};

export type Guidance = {
  id: string;
  title: string;
  type: GuidanceType;
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

/** Guidance whose `appliesTo` references the given topic. */
export function relatedGuidanceForTopic(
  guidances: ReadonlyArray<Guidance>,
  topicId: string,
): ReadonlyArray<Guidance> {
  return guidances.filter((guidance) => {
    const applies = guidance.appliesTo;
    if (!applies) return false;
    return (
      (applies.services?.includes(topicId) ?? false) ||
      (applies.landingZones?.includes(topicId) ?? false) ||
      (applies.securityPolicies?.includes(topicId) ?? false)
    );
  });
}

export function stepStatus(step: GuidanceStep, selectedStepId: string): StepStatus {
  if (step.id === selectedStepId) return "selected";
  if (step.kind === "destination") return "destination";
  if (step.marker) return step.marker;
  return "available";
}

/** First step a workspace should land on by default. */
export function defaultStepId(guidance: Guidance): string {
  return guidance.steps[0]?.id ?? "";
}
