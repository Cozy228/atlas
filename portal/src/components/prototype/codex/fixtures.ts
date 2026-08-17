export type EvidenceState = "Observed" | "Derived" | "Declared" | "Atlas-owned" | "Unknown";

export type JourneyStepStatus = "complete" | "blocked" | "waiting" | "upcoming";

export type JourneyStep = {
  id: string;
  label: string;
  status: JourneyStepStatus;
  owner: string;
  evidence?: string;
};

export type JourneyPhase = {
  id: string;
  label: string;
  steps: ReadonlyArray<JourneyStep>;
};

export type EvidenceItem = {
  id: string;
  title: string;
  state: EvidenceState;
  identifierLabel: "Run ID" | "Change ID" | "Request ID";
  identifier: string;
  retrievedAt: string;
  freshness: string;
  source: string;
  detail: string;
};

export const APP_CONTEXT = {
  name: "Lumen Checkout",
  code: "APP-4821",
  team: "Orion Product",
  owner: "Avery Morgan",
  environment: "DEV",
  repository: "example/lumen-checkout",
  branch: "feature/runtime-fix",
} as const;

export const JOURNEY_PHASES: ReadonlyArray<JourneyPhase> = [
  {
    id: "prepare",
    label: "Prepare",
    steps: [
      {
        id: "application",
        label: "Application identified",
        status: "complete",
        owner: "Atlas",
        evidence: "Application registry record APP-4821",
      },
      {
        id: "access",
        label: "Access ready",
        status: "complete",
        owner: "Platform Access",
        evidence: "Request REQ-1842 approved in the source system",
      },
      {
        id: "owner",
        label: "Application owner confirmed",
        status: "complete",
        owner: "Orion Product",
        evidence: "Avery Morgan confirmed ownership for this journey",
      },
      {
        id: "repository",
        label: "Repository ready",
        status: "complete",
        owner: "Orion Product",
        evidence: "Repository default branch and build definition observed",
      },
    ],
  },
  {
    id: "foundation",
    label: "Build foundation",
    steps: [
      {
        id: "infrastructure",
        label: "Infrastructure ready",
        status: "complete",
        owner: "Cloud Platform",
        evidence: "Workspace run RUN-3041 completed",
      },
      {
        id: "delivery",
        label: "Delivery configured",
        status: "complete",
        owner: "Delivery Platform",
        evidence: "DEV delivery target observed",
      },
    ],
  },
  {
    id: "deploy",
    label: "Deploy to DEV",
    steps: [
      {
        id: "runtime",
        label: "Runtime configuration blocked",
        status: "blocked",
        owner: "Orion Product",
        evidence: "Runtime validation failed in RUN-7f3b1a9c",
      },
      { id: "deploy-dev", label: "Deploy to DEV", status: "upcoming", owner: "Delivery Platform" },
      { id: "health", label: "Verify health", status: "upcoming", owner: "Atlas" },
      { id: "complete", label: "Complete", status: "upcoming", owner: "Atlas" },
    ],
  },
];

export const BLOCKER_EVIDENCE: ReadonlyArray<EvidenceItem> = [
  {
    id: "deployment-log",
    title: "Deployment log",
    state: "Observed",
    identifierLabel: "Run ID",
    identifier: "RUN-7f3b1a9c",
    retrievedAt: "Aug 14, 2026  09:21",
    freshness: "2m ago",
    source: "Deployment logs",
    detail:
      "Runtime validation reported that DB_PASSWORD is missing and DB_PASS is not recognized.",
  },
  {
    id: "service-manifest",
    title: "Service manifest",
    state: "Derived",
    identifierLabel: "Change ID",
    identifier: "CHG-c8d4e2b1",
    retrievedAt: "Aug 14, 2026  09:19",
    freshness: "4m ago",
    source: "Service manifest (app.yaml)",
    detail: "The manifest declares DB_PASSWORD as the database password key.",
  },
  {
    id: "deployment-specification",
    title: "Deployment specification",
    state: "Observed",
    identifierLabel: "Change ID",
    identifier: "CHG-c8d4e2b1",
    retrievedAt: "Aug 14, 2026  09:19",
    freshness: "4m ago",
    source: "Deployment spec (atlas.yaml)",
    detail: "The DEV specification references DB_PASS from the configured secret registry.",
  },
];

export const RESOLVED_CONTEXT = [
  {
    label: "Application",
    value: APP_CONTEXT.name,
    source: "Application registry",
    state: "Observed",
  },
  { label: "Team", value: APP_CONTEXT.team, source: "Team directory", state: "Observed" },
  {
    label: "Repository",
    value: APP_CONTEXT.repository,
    source: "Source control",
    state: "Observed",
  },
  {
    label: "Environment",
    value: APP_CONTEXT.environment,
    source: "Journey input",
    state: "Declared",
  },
  {
    label: "Cloud account",
    value: "DEV account · Orion",
    source: "Account inventory",
    state: "Derived",
  },
  { label: "Region", value: "East region", source: "Platform policy", state: "Derived" },
  {
    label: "Resource name",
    value: "lumen-checkout-dev",
    source: "Naming policy",
    state: "Derived",
  },
  {
    label: "Permission context",
    value: "Minimum required set",
    source: "Access catalog",
    state: "Derived",
  },
] as const satisfies ReadonlyArray<{
  label: string;
  value: string;
  source: string;
  state: EvidenceState;
}>;

export const ONBOARDING_DECISIONS = [
  {
    id: "internal",
    title: "Internal-only endpoint",
    description: "Reachable only from the private DEV network. Recommended for early validation.",
  },
  {
    id: "public",
    title: "Internet-facing endpoint",
    description: "Reachable from the public internet. Requires an additional policy review.",
  },
] as const;

export const RUN_TIMELINE = [
  {
    id: "build",
    label: "Build",
    status: "complete",
    detail: "Image built and scanned",
    duration: "2m 12s",
  },
  {
    id: "deploy",
    label: "Deploy",
    status: "complete",
    detail: "DEV resources configured",
    duration: "1m 58s",
  },
  {
    id: "validate",
    label: "Runtime validation",
    status: "failed",
    detail: "Secret key contract mismatch",
    duration: "47s",
  },
  {
    id: "recover",
    label: "Safe recovery",
    status: "pending",
    detail: "Waiting for human review",
    duration: "—",
  },
] as const;

export const EXTERNAL_WAIT = {
  requestId: "SYNC-9912",
  owner: "Secret Registry",
  status: "Waiting for source-system refresh",
  since: "Aug 14, 2026 · 08:42 UTC",
  nextCheck: "10:00 UTC",
} as const;
