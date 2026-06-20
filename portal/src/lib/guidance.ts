/**
 * Atlas Guidance — local route-guidance model and fixtures.
 *
 * Mirrors the V1 design in `docs/product/guidance_design.md`: Guidance -> steps -> tasks,
 * rendered as a vertical stepper. There is no backend for guidance yet, so these are
 * public-safe, fictional definitions. No user progress is tracked; step status is computed
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
    guardrails?: ReadonlyArray<string>;
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

const GUIDANCES: ReadonlyArray<Guidance> = [
  {
    id: "new-app-onboarding",
    title: "New Application Onboarding",
    type: "route",
    scenario: "onboarding",
    family: "onboard",
    objective: "Help an application team onboard a new cloud workload to the standard platform.",
    destination: {
      title: "Application ready for standard cloud deployment",
      description: "The app has approved access, a provisioning path, and passes readiness checks.",
    },
    owner: { team: "Cloud Platform", support: "cloud-platform-support" },
    status: "published",
    version: "1.2.0",
    lastReviewed: "2026-04-18",
    appliesTo: {
      services: ["serverless-compute"],
      landingZones: ["central-landing-zone"],
    },
    sources: ["platform-reference-guide", "central-lz-confluence"],
    steps: [
      {
        id: "choose-landing-zone",
        title: "Choose landing zone",
        kind: "decision",
        description: "Select the landing zone that matches this workload's data and compliance needs.",
        why: "The landing zone sets the guardrails, networking, and IAM boundary your app inherits.",
        tasks: [
          {
            id: "review-options",
            title: "Review landing zone options",
            action: { type: "atlas_page", label: "Open landing zones", target: "/catalog" },
          },
          { id: "confirm-choice", title: "Confirm the selected landing zone", required: true },
        ],
        sources: ["central-lz-confluence"],
      },
      {
        id: "request-access",
        title: "Request access",
        kind: "action",
        description: "Open the approved access request path for the selected landing zone.",
        why: "Access must be granted through the approved request flow — Atlas does not submit it for you.",
        tasks: [
          {
            id: "open-request-form",
            title: "Open the access request form",
            required: true,
            action: {
              type: "external_link",
              label: "Open request form",
              target: "https://example.internal/access-request",
            },
          },
        ],
      },
      {
        id: "open-tfe",
        title: "Open Terraform Enterprise",
        kind: "action",
        description: "Use the approved TFE workspace or module to provision infrastructure.",
        why: "Provisioning runs through the approved infrastructure-as-code path, not the console.",
        tasks: [
          {
            id: "open-tfe-workspace",
            title: "Open the standard TFE workspace",
            required: true,
            action: {
              type: "tool_link",
              label: "Open TFE workspace",
              target: "https://example.internal/tfe/standard",
            },
          },
          {
            id: "copy-module",
            title: "Copy the module reference",
            action: {
              type: "copy_text",
              label: "Copy module ref",
              text: "module \"app\" { source = \"app.terraform.io/example/standard/aws\" }",
            },
          },
        ],
        sources: ["lambda-module-readme"],
      },
      {
        id: "connect-harness",
        title: "Connect Harness pipeline",
        kind: "action",
        description: "Connect the standard deployment path for your service.",
        why: "Deployments are promoted through the approved Harness pipeline templates.",
        tasks: [
          {
            id: "open-harness",
            title: "Open the Harness setup guide",
            action: {
              type: "external_link",
              label: "Open Harness guide",
              target: "https://example.internal/harness/standard",
            },
          },
        ],
      },
      {
        id: "production-readiness",
        title: "Production readiness",
        kind: "checklist",
        description: "Confirm required checks before promoting the workload to production.",
        why: "Readiness is verified outside Atlas — this is the checklist, not a sign-off record.",
        tasks: [
          { id: "logging", title: "Logging and monitoring enabled", required: true },
          { id: "tags", title: "Required resource tags applied", required: true },
          { id: "iam", title: "IAM role pattern reviewed", required: true },
          { id: "support-owner", title: "Support owner confirmed", required: true },
        ],
        sources: ["logging-standard-doc", "iam-boundary-policy"],
      },
      {
        id: "done",
        title: "Onboarding complete",
        kind: "destination",
        description: "The application is ready for standard cloud deployment.",
      },
    ],
  },
  {
    id: "landing-zone-selection",
    title: "Landing Zone Selection",
    type: "decision",
    scenario: "service_enablement",
    family: "decide",
    objective: "Match a workload's data sensitivity and lifecycle to the right landing zone.",
    destination: {
      title: "Landing zone selected with rationale",
      description: "You can justify the chosen zone against its guardrails and intended use.",
    },
    owner: { team: "Cloud Platform", support: "cloud-platform-support" },
    status: "published",
    version: "1.0.0",
    lastReviewed: "2026-03-30",
    appliesTo: {
      landingZones: ["central-landing-zone", "regulated-landing-zone", "sandbox-landing-zone"],
    },
    sources: ["central-lz-confluence", "regulated-lz-confluence", "sandbox-lz-confluence"],
    steps: [
      {
        id: "gather-requirements",
        title: "Gather requirements",
        kind: "action",
        description: "Capture the workload's data classification, environment, and lifecycle.",
        why: "Zone fit is driven by data sensitivity and how long the workload lives.",
        tasks: [
          { id: "classify-data", title: "Classify the workload's data sensitivity", required: true },
          { id: "confirm-lifecycle", title: "Confirm expected lifecycle (temporary vs long-lived)" },
        ],
      },
      {
        id: "choose-zone",
        title: "Choose a landing zone",
        kind: "decision",
        description: "Pick the zone whose guardrails match the requirements you gathered.",
        why: "Each zone trades flexibility for control differently.",
        options: [
          {
            id: "central",
            title: "Central Landing Zone",
            description: "Standard production workloads with baseline guardrails.",
            to: "/catalog/$topicId",
          },
          {
            id: "regulated",
            title: "Regulated Landing Zone",
            description: "Sensitive or compliance-bound workloads with stricter controls.",
            to: "/catalog/$topicId",
          },
          {
            id: "sandbox",
            title: "Sandbox Landing Zone",
            description: "Short-lived experiments that expire automatically.",
            to: "/catalog/$topicId",
          },
        ],
        sources: ["regulated-lz-confluence"],
      },
      {
        id: "decided",
        title: "Selection complete",
        kind: "destination",
        description: "Continue to onboarding with the chosen landing zone.",
      },
    ],
  },
  {
    id: "production-readiness",
    title: "Production Readiness Checklist",
    type: "checklist",
    scenario: "production_readiness",
    family: "validate",
    objective: "Confirm a workload meets platform guardrails before production use.",
    destination: {
      title: "Workload cleared for production",
      description: "All required guardrail checks are understood and satisfied outside Atlas.",
    },
    owner: { team: "Platform Assurance", support: "platform-assurance-support" },
    status: "needs_review",
    version: "0.9.0",
    lastReviewed: "2025-11-12",
    appliesTo: {
      services: ["aws-textract", "aws-bedrock", "serverless-compute"],
      guardrails: ["logging-monitoring", "iam-boundary", "s3-guardrails"],
    },
    sources: ["logging-standard-doc", "iam-boundary-policy", "s3-policy-doc"],
    steps: [
      {
        id: "logging",
        title: "Logging and monitoring",
        kind: "checklist",
        description: "Confirm the workload emits the required platform signals.",
        why: "Operational visibility is a precondition for production support.",
        tasks: [
          { id: "logs", title: "Structured logs shipped to the platform sink", required: true },
          { id: "alerts", title: "Baseline alerts configured", required: true },
        ],
        sources: ["logging-standard-doc"],
      },
      {
        id: "iam",
        title: "IAM boundary",
        kind: "checklist",
        description: "Confirm roles follow the delegated IAM boundary pattern.",
        why: "Over-broad roles are the most common production readiness blocker.",
        tasks: [
          { id: "least-privilege", title: "Roles scoped to least privilege", required: true },
          { id: "no-wildcards", title: "No wildcard administrative policies", required: true },
        ],
        sources: ["iam-boundary-policy"],
        marker: "needs_support",
      },
      {
        id: "storage",
        title: "Storage guardrails",
        kind: "checklist",
        description: "Confirm object storage follows the approved access policy.",
        why: "Public exposure of buckets is a hard blocker for production.",
        tasks: [
          { id: "no-public", title: "No public bucket access", required: true },
          { id: "encryption", title: "Encryption at rest enabled", required: true },
        ],
        sources: ["s3-policy-doc"],
      },
      {
        id: "cleared",
        title: "Readiness confirmed",
        kind: "destination",
        description: "The workload meets the required guardrails for production.",
      },
    ],
  },
];

export function listGuidance(): ReadonlyArray<Guidance> {
  return GUIDANCES;
}

export function getGuidance(id: string): Guidance | undefined {
  return GUIDANCES.find((guidance) => guidance.id === id);
}

export function guidanceByFamily(): ReadonlyArray<{
  family: (typeof SCENARIO_FAMILIES)[number];
  items: ReadonlyArray<Guidance>;
}> {
  return SCENARIO_FAMILIES.map((family) => ({
    family,
    items: GUIDANCES.filter((guidance) => guidance.family === family.id),
  })).filter((group) => group.items.length > 0);
}

/** Guidance whose `appliesTo` references the given topic. */
export function relatedGuidanceForTopic(topicId: string): ReadonlyArray<Guidance> {
  return GUIDANCES.filter((guidance) => {
    const applies = guidance.appliesTo;
    if (!applies) return false;
    return (
      (applies.services?.includes(topicId) ?? false) ||
      (applies.landingZones?.includes(topicId) ?? false) ||
      (applies.guardrails?.includes(topicId) ?? false)
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
