/**
 * Prototype "kimi" — deterministic fictional fixtures.
 *
 * Everything in this file is invented: applications, people, teams, account
 * numbers, request IDs, runs, and URLs. Public vendor names appear only as
 * neutral source labels. Timestamps are fixed relative to PROTOTYPE_NOW so
 * freshness and age rendering stay deterministic across reloads.
 */

/** Fixed reference time for the prototype. All ages and freshness derive from it. */
export const PROTOTYPE_NOW = "2026-08-14T09:41:00Z";

// ---------------------------------------------------------------------------
// Sources (neutral labels for external systems Atlas projects from)
// ---------------------------------------------------------------------------

export type SourceId =
  | "atlas"
  | "app-registry"
  | "sailpoint"
  | "servicenow"
  | "tfe"
  | "harness"
  | "vault"
  | "aws"
  | "scm";

export const SOURCES: Record<SourceId, { label: string }> = {
  atlas: { label: "Atlas" },
  "app-registry": { label: "App registry" },
  sailpoint: { label: "SailPoint" },
  servicenow: { label: "ServiceNow" },
  tfe: { label: "Terraform Enterprise" },
  harness: { label: "Harness" },
  vault: { label: "Vault" },
  aws: { label: "AWS" },
  scm: { label: "GitHub Enterprise" },
};

// ---------------------------------------------------------------------------
// State vocabulary
// ---------------------------------------------------------------------------

/** Where a piece of state comes from (Atlas.md §5.4 evidence model). */
export type StateKind = "observed" | "derived" | "declared" | "atlas" | "unknown";

export const STATE_KIND_LABEL: Record<StateKind, string> = {
  observed: "Observed",
  derived: "Derived",
  declared: "Declared",
  atlas: "Atlas-owned",
  unknown: "Unknown",
};

export type Freshness = "fresh" | "stale";

/** Fresh when retrieved within the last 24h relative to PROTOTYPE_NOW. */
export function freshnessOf(retrievedAt: string): Freshness {
  const ageMs = Date.parse(PROTOTYPE_NOW) - Date.parse(retrievedAt);
  return ageMs <= 24 * 60 * 60 * 1000 ? "fresh" : "stale";
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact deterministic age, e.g. "26h", "2d 18h". */
export function timeAgo(iso: string): string {
  const ageMs = Math.max(0, Date.parse(PROTOTYPE_NOW) - Date.parse(iso));
  if (ageMs < HOUR) return `${Math.max(1, Math.round(ageMs / MINUTE))}m`;
  if (ageMs < DAY) return `${Math.round(ageMs / HOUR)}h`;
  const days = Math.floor(ageMs / DAY);
  const hours = Math.round((ageMs - days * DAY) / HOUR);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
}

/** "14 Aug, 09:12 UTC" */
export function fmtUtc(iso: string): string {
  const d = new Date(iso);
  const day = d.getUTCDate();
  const month = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month}, ${hh}:${mm} UTC`;
}

// ---------------------------------------------------------------------------
// People and teams (fictional)
// ---------------------------------------------------------------------------

export interface Person {
  id: string;
  name: string;
  role: string;
}

export const PEOPLE: Record<string, Person> = {
  "p-jonas": { id: "p-jonas", name: "Jonas Lindgren", role: "Developer, Team Meridian" },
  "p-maya": { id: "p-maya", name: "Maya Chen", role: "Application owner, Paygate" },
  "p-tomas": { id: "p-tomas", name: "Tomas Richter", role: "Application owner, Ledgerline" },
  "p-priya": { id: "p-priya", name: "Priya Nair", role: "Application owner, Fieldnotes" },
  "p-sam": { id: "p-sam", name: "Sam Okafor", role: "Platform engineer, Cloud Foundations" },
  "p-elena": { id: "p-elena", name: "Elena Petrova", role: "IAM approver, Cloud Foundations" },
};

/** The signed-in prototype persona. */
export const CURRENT_USER = PEOPLE["p-jonas"];

export interface Team {
  id: string;
  name: string;
  supportQueue: string;
}

export const TEAMS: Record<string, Team> = {
  "t-meridian": { id: "t-meridian", name: "Team Meridian", supportQueue: "MER-APP" },
  "t-cobalt": { id: "t-cobalt", name: "Team Cobalt", supportQueue: "COB-APP" },
  "t-aurora": { id: "t-aurora", name: "Team Aurora", supportQueue: "AUR-APP" },
  "t-foundations": { id: "t-foundations", name: "Cloud Foundations", supportQueue: "CF-SEC" },
};

export function personName(id: string): string {
  return PEOPLE[id]?.name ?? id;
}

export function teamName(id: string): string {
  return TEAMS[id]?.name ?? id;
}

// ---------------------------------------------------------------------------
// Applications (fictional)
// ---------------------------------------------------------------------------

export interface CloudAccount {
  id: string;
  provider: "AWS";
  region: string;
  environment: "DEV";
}

export interface AtlasApp {
  id: string;
  code: string;
  name: string;
  description: string;
  teamId: string;
  ownerId: string;
  repoUrl: string | null;
  language: string | null;
  account: CloudAccount | null;
}

export const APPS = [
  {
    id: "paygate",
    code: "PAY-412",
    name: "Paygate",
    description: "Payment authorization API",
    teamId: "t-meridian",
    ownerId: "p-maya",
    repoUrl: "https://git.example.com/meridian/paygate",
    language: "TypeScript, Node 22",
    account: { id: "2109-8765-4321", provider: "AWS", region: "eu-west-1", environment: "DEV" },
  },
  {
    id: "ledgerline",
    code: "LED-208",
    name: "Ledgerline",
    description: "Nightly reconciliation batch jobs",
    teamId: "t-cobalt",
    ownerId: "p-tomas",
    repoUrl: "https://git.example.com/cobalt/ledgerline",
    language: "Python 3.13",
    account: { id: "2109-8765-7788", provider: "AWS", region: "eu-west-1", environment: "DEV" },
  },
  {
    id: "fieldnotes",
    code: "FLD-090",
    name: "Fieldnotes",
    description: "Field report capture web app",
    teamId: "t-aurora",
    ownerId: "p-priya",
    repoUrl: null,
    language: null,
    account: null,
  },
] as const satisfies readonly AtlasApp[];

export type AppId = (typeof APPS)[number]["id"];

export const DEFAULT_APP_ID: AppId = "paygate";

export const APP_MAP: Record<AppId, AtlasApp> = Object.fromEntries(
  APPS.map((app) => [app.id, app]),
) as Record<AppId, AtlasApp>;

export function isAppId(value: unknown): value is AppId {
  return typeof value === "string" && APPS.some((app) => app.id === value);
}

// ---------------------------------------------------------------------------
// Golden path definition (Atlas-owned, versioned)
// ---------------------------------------------------------------------------

export interface StageDef {
  id: string;
  station: number;
  title: string;
  outcome: string;
  ownerRole: string;
}

export interface GoldenPath {
  id: string;
  name: string;
  version: string;
  ownerTeamId: string;
  updatedAt: string;
  reviewDue: string;
  stages: StageDef[];
}

export const GOLDEN_PATH: GoldenPath = {
  id: "gp-aws-ecs-first-dev",
  name: "Container workload on AWS, first DEV deployment",
  version: "v1.3.2",
  ownerTeamId: "t-foundations",
  updatedAt: "2026-07-28T10:00:00Z",
  reviewDue: "2026-10-01T00:00:00Z",
  stages: [
    {
      id: "identify",
      station: 1,
      title: "Identify application",
      outcome: "App code resolves to a registered application profile.",
      ownerRole: "App team",
    },
    {
      id: "access",
      station: 2,
      title: "Access & account",
      outcome: "Required group memberships approved and AWS DEV account mapped.",
      ownerRole: "Cloud Foundations",
    },
    {
      id: "delivery",
      station: 3,
      title: "Repository & delivery",
      outcome: "Repository connected; Harness project, connector and pipeline exist.",
      ownerRole: "App team",
    },
    {
      id: "infra",
      station: 4,
      title: "Infrastructure",
      outcome: "Terraform Enterprise workspace applied for the DEV environment.",
      ownerRole: "Cloud Foundations",
    },
    {
      id: "runtime",
      station: 5,
      title: "Runtime & secrets",
      outcome: "Task definition, secret references and runtime config validated.",
      ownerRole: "App team",
    },
    {
      id: "first-deploy",
      station: 6,
      title: "First DEV deployment",
      outcome: "Deployment succeeds and the minimal health check passes.",
      ownerRole: "App team",
    },
  ],
};

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

export interface Evidence {
  id: string;
  label: string;
  source: SourceId;
  kind: StateKind;
  externalId?: string;
  retrievedAt: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Journeys (stateful executions of the golden path, per application)
// ---------------------------------------------------------------------------

export type StationStatus = "complete" | "current" | "blocked" | "failed" | "upcoming" | "skipped";

export type StepStatus = "done" | "waiting" | "failed" | "pending" | "skipped";

export interface StepState {
  id: string;
  title: string;
  status: StepStatus;
  kind: StateKind;
  detail?: string;
  evidence?: Evidence[];
}

export interface Blocker {
  title: string;
  ticketId: string;
  source: SourceId;
  waitingOnPersonId: string;
  since: string;
  next: string;
}

export interface StationState {
  stageId: string;
  status: StationStatus;
  summary?: string;
  steps: StepState[];
  blocker?: Blocker;
  branch?: { title: string; state: "skipped"; reason: string; decidedById: string };
}

export interface Journey {
  appId: AppId;
  goldenPathId: string;
  startedAt: string;
  completedAt?: string;
  stations: StationState[];
  completionEvidence?: Evidence[];
}

const PAYGATE_STATIONS: StationState[] = [
  {
    stageId: "identify",
    status: "complete",
    summary: "App code PAY-412 resolved to the Paygate application profile.",
    steps: [
      {
        id: "identify-resolve",
        title: "Application profile resolved",
        status: "done",
        kind: "observed",
        evidence: [
          {
            id: "ev-pay-profile",
            label: "Application profile",
            source: "app-registry",
            kind: "observed",
            externalId: "PAY-412",
            retrievedAt: "2026-08-06T10:14:00Z",
          },
        ],
      },
      {
        id: "identify-owner",
        title: "Ownership confirmed",
        status: "done",
        kind: "declared",
        detail: "Confirmed by Maya Chen, 6 Aug.",
      },
    ],
  },
  {
    stageId: "access",
    status: "complete",
    summary: "Developer group membership approved; DEV account mapped.",
    steps: [
      {
        id: "access-group",
        title: "Group membership approved",
        status: "done",
        kind: "observed",
        evidence: [
          {
            id: "ev-pay-req-104812",
            label: "Access request REQ-104812",
            source: "sailpoint",
            kind: "observed",
            externalId: "REQ-104812",
            retrievedAt: "2026-08-07T09:03:00Z",
            note: "Approved by E. Petrova",
          },
        ],
      },
      {
        id: "access-account",
        title: "AWS DEV account mapped",
        status: "done",
        kind: "observed",
        evidence: [
          {
            id: "ev-pay-account",
            label: "Account mapping",
            source: "aws",
            kind: "observed",
            externalId: "2109-8765-4321",
            retrievedAt: "2026-08-07T09:40:00Z",
            note: "eu-west-1, DEV",
          },
        ],
      },
    ],
  },
  {
    stageId: "delivery",
    status: "complete",
    summary: "Repository connected; Harness project, connector and pipeline created.",
    steps: [
      {
        id: "delivery-repo",
        title: "Repository connected",
        status: "done",
        kind: "observed",
        evidence: [
          {
            id: "ev-pay-repo",
            label: "Repository mirror",
            source: "scm",
            kind: "observed",
            externalId: "meridian/paygate",
            retrievedAt: "2026-08-07T11:22:00Z",
          },
        ],
      },
      {
        id: "delivery-harness",
        title: "Harness project, connector and pipeline created",
        status: "done",
        kind: "observed",
        evidence: [
          {
            id: "ev-pay-setup-run",
            label: "Setup run pay-setup-0131",
            source: "harness",
            kind: "observed",
            externalId: "pay-setup-0131",
            retrievedAt: "2026-08-08T13:05:00Z",
          },
        ],
      },
    ],
  },
  {
    stageId: "infra",
    status: "complete",
    summary: "Workspace paygate-dev applied. State snapshot is older than 24h.",
    steps: [
      {
        id: "infra-apply",
        title: "Terraform workspace applied",
        status: "done",
        kind: "observed",
        evidence: [
          {
            id: "ev-pay-tfe",
            label: "Workspace apply tfe-run-8812",
            source: "tfe",
            kind: "observed",
            externalId: "tfe-run-8812",
            retrievedAt: "2026-08-13T07:20:00Z",
            note: "State snapshot retrieved 26h ago. Re-check before relying on outputs.",
          },
        ],
      },
      {
        id: "infra-outputs",
        title: "Outputs projected (cluster, role, log group)",
        status: "done",
        kind: "derived",
        detail: "Derived from the workspace state snapshot.",
      },
    ],
    branch: {
      title: "Managed cache add-on",
      state: "skipped",
      reason: "Not needed for DEV. Revisit before UAT.",
      decidedById: "p-maya",
    },
  },
  {
    stageId: "runtime",
    status: "blocked",
    summary: "Task definition drafted; Vault read access is waiting on approval.",
    steps: [
      {
        id: "runtime-taskdef",
        title: "Task definition drafted (revision 14)",
        status: "done",
        kind: "observed",
        evidence: [
          {
            id: "ev-pay-taskdef",
            label: "Task definition paygate:14",
            source: "harness",
            kind: "observed",
            externalId: "paygate:14",
            retrievedAt: "2026-08-13T15:44:00Z",
          },
        ],
      },
      {
        id: "runtime-secret-refs",
        title: "Secret references declared",
        status: "done",
        kind: "declared",
        detail: "Declared by Maya Chen, 13 Aug.",
      },
      {
        id: "runtime-vault-access",
        title: "Vault read access for paygate-dev",
        status: "waiting",
        kind: "observed",
        detail: "Policy change requested, approval pending.",
      },
    ],
    blocker: {
      title: "Vault policy: grant paygate-dev read on paygate/dev/*",
      ticketId: "REQ-105031",
      source: "servicenow",
      waitingOnPersonId: "p-elena",
      since: "2026-08-11T15:02:00Z",
      next: "When approved, the paygate-dev role gains read access and Atlas re-checks this step automatically.",
    },
  },
  {
    stageId: "first-deploy",
    status: "failed",
    summary:
      "Deployment pay-deploy-0142 was triggered before station 5 cleared and failed at secret resolution.",
    steps: [
      {
        id: "deploy-artifact",
        title: "Artifact b-1.4.7 available",
        status: "done",
        kind: "observed",
        evidence: [
          {
            id: "ev-pay-artifact",
            label: "CI build pay-ci-0139",
            source: "harness",
            kind: "observed",
            externalId: "b-1.4.7",
            retrievedAt: "2026-08-13T16:44:00Z",
          },
        ],
      },
      {
        id: "deploy-run",
        title: "Deploy to DEV",
        status: "failed",
        kind: "observed",
        detail: "Run pay-deploy-0142 failed: secret reference could not be resolved.",
        evidence: [
          {
            id: "ev-pay-deploy-fail",
            label: "Deployment run pay-deploy-0142",
            source: "harness",
            kind: "observed",
            externalId: "pay-deploy-0142",
            retrievedAt: "2026-08-14T09:12:00Z",
          },
        ],
      },
      {
        id: "deploy-health",
        title: "Minimal health check",
        status: "pending",
        kind: "unknown",
        detail: "Not reached.",
      },
    ],
  },
];

const LEDGERLINE_STATIONS: StationState[] = GOLDEN_PATH.stages.map((stage) => ({
  stageId: stage.id,
  status: "complete",
  summary: undefined,
  steps: [],
}));

// Rich step content for the completed journey, kept terse where repetition adds nothing.
LEDGERLINE_STATIONS[0]!.steps = [
  {
    id: "led-identify",
    title: "Application profile resolved",
    status: "done",
    kind: "observed",
    evidence: [
      {
        id: "ev-led-profile",
        label: "Application profile",
        source: "app-registry",
        kind: "observed",
        externalId: "LED-208",
        retrievedAt: "2026-07-20T09:00:00Z",
      },
    ],
  },
];
LEDGERLINE_STATIONS[1]!.steps = [
  {
    id: "led-access",
    title: "Group membership approved",
    status: "done",
    kind: "observed",
    evidence: [
      {
        id: "ev-led-req",
        label: "Access request REQ-103977",
        source: "sailpoint",
        kind: "observed",
        externalId: "REQ-103977",
        retrievedAt: "2026-07-21T10:12:00Z",
      },
    ],
  },
  {
    id: "led-account",
    title: "AWS DEV account mapped",
    status: "done",
    kind: "observed",
    evidence: [
      {
        id: "ev-led-account",
        label: "Account mapping",
        source: "aws",
        kind: "observed",
        externalId: "2109-8765-7788",
        retrievedAt: "2026-07-21T10:30:00Z",
      },
    ],
  },
];
LEDGERLINE_STATIONS[2]!.steps = [
  {
    id: "led-delivery",
    title: "Harness project, connector and pipeline created",
    status: "done",
    kind: "observed",
    evidence: [
      {
        id: "ev-led-setup",
        label: "Setup run led-setup-0019",
        source: "harness",
        kind: "observed",
        externalId: "led-setup-0019",
        retrievedAt: "2026-07-24T15:40:00Z",
      },
    ],
  },
];
LEDGERLINE_STATIONS[3]!.steps = [
  {
    id: "led-infra",
    title: "Terraform workspace applied",
    status: "done",
    kind: "observed",
    evidence: [
      {
        id: "ev-led-tfe",
        label: "Workspace apply tfe-run-8601",
        source: "tfe",
        kind: "observed",
        externalId: "tfe-run-8601",
        retrievedAt: "2026-07-29T08:02:00Z",
      },
    ],
  },
];
LEDGERLINE_STATIONS[4]!.steps = [
  {
    id: "led-runtime",
    title: "Runtime config and secret references validated",
    status: "done",
    kind: "observed",
    evidence: [
      {
        id: "ev-led-runtime",
        label: "Validation run led-check-0020",
        source: "harness",
        kind: "observed",
        externalId: "led-check-0020",
        retrievedAt: "2026-08-01T11:18:00Z",
      },
    ],
  },
];
LEDGERLINE_STATIONS[5]!.steps = [
  {
    id: "led-deploy",
    title: "Deploy to DEV",
    status: "done",
    kind: "observed",
    evidence: [
      {
        id: "ev-led-deploy",
        label: "Deployment run led-deploy-0021",
        source: "harness",
        kind: "observed",
        externalId: "led-deploy-0021",
        retrievedAt: "2026-08-02T14:02:00Z",
      },
    ],
  },
  {
    id: "led-health",
    title: "Minimal health check passed",
    status: "done",
    kind: "observed",
    detail: "Health endpoint returned 200 for 5 consecutive checks.",
  },
];

const FIELDNOTES_STATIONS: StationState[] = [
  {
    stageId: "identify",
    status: "complete",
    summary: "App code FLD-090 resolved to the Fieldnotes application profile.",
    steps: [
      {
        id: "fld-identify",
        title: "Application profile resolved",
        status: "done",
        kind: "observed",
        evidence: [
          {
            id: "ev-fld-profile",
            label: "Application profile",
            source: "app-registry",
            kind: "observed",
            externalId: "FLD-090",
            retrievedAt: "2026-08-13T10:58:00Z",
          },
        ],
      },
    ],
  },
  {
    stageId: "access",
    status: "current",
    summary: "Prerequisite scan found two open items.",
    steps: [
      {
        id: "fld-prereq",
        title: "Prerequisite scan",
        status: "done",
        kind: "derived",
        detail: "Derived from app registry, source control and SailPoint projections.",
      },
      {
        id: "fld-repo",
        title: "Repository connected",
        status: "pending",
        kind: "unknown",
        detail: "No repository is linked to FLD-090. Connect one to continue.",
      },
      {
        id: "fld-access",
        title: "Group membership for aurora-developers",
        status: "waiting",
        kind: "observed",
        detail: "Request REQ-105102 submitted, approval pending.",
      },
    ],
    blocker: {
      title: "Group membership: aurora-developers",
      ticketId: "REQ-105102",
      source: "sailpoint",
      waitingOnPersonId: "p-elena",
      since: "2026-08-13T13:20:00Z",
      next: "When approved, Atlas marks this step observed and unlocks account mapping.",
    },
  },
  { stageId: "delivery", status: "upcoming", steps: [] },
  { stageId: "infra", status: "upcoming", steps: [] },
  { stageId: "runtime", status: "upcoming", steps: [] },
  { stageId: "first-deploy", status: "upcoming", steps: [] },
];

export const JOURNEYS: Record<AppId, Journey> = {
  paygate: {
    appId: "paygate",
    goldenPathId: GOLDEN_PATH.id,
    startedAt: "2026-08-06T10:15:00Z",
    stations: PAYGATE_STATIONS,
  },
  ledgerline: {
    appId: "ledgerline",
    goldenPathId: GOLDEN_PATH.id,
    startedAt: "2026-07-20T09:00:00Z",
    completedAt: "2026-08-02T14:03:00Z",
    stations: LEDGERLINE_STATIONS,
    completionEvidence: [
      {
        id: "ev-led-complete-deploy",
        label: "First successful DEV deployment",
        source: "harness",
        kind: "observed",
        externalId: "led-deploy-0021",
        retrievedAt: "2026-08-02T14:02:00Z",
      },
      {
        id: "ev-led-complete-health",
        label: "Health check passed (5/5)",
        source: "harness",
        kind: "observed",
        externalId: "led-check-0021",
        retrievedAt: "2026-08-02T14:03:00Z",
      },
      {
        id: "ev-led-complete-signoff",
        label: "Owner sign-off",
        source: "atlas",
        kind: "declared",
        retrievedAt: "2026-08-02T15:11:00Z",
        note: "Confirmed by Tomas Richter",
      },
    ],
  },
  fieldnotes: {
    appId: "fieldnotes",
    goldenPathId: GOLDEN_PATH.id,
    startedAt: "2026-08-13T11:00:00Z",
    stations: FIELDNOTES_STATIONS,
  },
};

// ---------------------------------------------------------------------------
// Action runs (fixture history; simulated runs live in run-store.ts)
// ---------------------------------------------------------------------------

export type RunStatus = "queued" | "running" | "waiting-approval" | "success" | "failed";

export interface RunStep {
  at: string;
  label: string;
  status: "done" | "failed" | "running" | "pending";
  detail?: string;
}

export interface Run {
  id: string;
  appId: AppId;
  action: string;
  targetSystem: SourceId;
  status: RunStatus;
  statusLabel?: string;
  triggeredById: string;
  startedAt: string;
  endedAt?: string;
  steps: RunStep[];
  inputs?: Record<string, string>;
  error?: { class: string; message: string; stage: string };
  simulated?: boolean;
  /** Set on simulated runs so the run page can advance them along their plan. */
  intentId?: IntentId;
}

export const RUNS: Run[] = [
  {
    id: "pay-deploy-0142",
    appId: "paygate",
    action: "Deploy to DEV",
    targetSystem: "harness",
    status: "failed",
    statusLabel: "Secret reference could not be resolved",
    triggeredById: "p-jonas",
    startedAt: "2026-08-14T09:11:32Z",
    endedAt: "2026-08-14T09:12:48Z",
    inputs: { artifact: "b-1.4.7", environment: "dev", taskDefinition: "paygate:14" },
    steps: [
      { at: "2026-08-14T09:11:32Z", label: "Queued", status: "done" },
      { at: "2026-08-14T09:11:40Z", label: "Fetch artifact b-1.4.7", status: "done" },
      {
        at: "2026-08-14T09:11:55Z",
        label: "Render task definition rev 14",
        status: "done",
      },
      {
        at: "2026-08-14T09:12:31Z",
        label: "Resolve secrets",
        status: "failed",
        detail: "Secret reference 'paygate/dev/db-password' not found in Vault.",
      },
      {
        at: "2026-08-14T09:12:48Z",
        label: "Abort deployment",
        status: "done",
        detail: "No containers started. Previous revision keeps running.",
      },
    ],
    error: {
      class: "SecretNotFound",
      message: "Secret reference 'paygate/dev/db-password' could not be resolved in Vault.",
      stage: "Resolve secrets",
    },
  },
  {
    id: "pay-ci-0139",
    appId: "paygate",
    action: "CI build",
    targetSystem: "harness",
    status: "success",
    statusLabel: "Artifact b-1.4.7 published",
    triggeredById: "p-jonas",
    startedAt: "2026-08-13T16:40:11Z",
    endedAt: "2026-08-13T16:44:02Z",
    inputs: { commit: "a41c9e2", branch: "main" },
    steps: [
      { at: "2026-08-13T16:40:11Z", label: "Queued", status: "done" },
      { at: "2026-08-13T16:40:19Z", label: "Checkout a41c9e2", status: "done" },
      { at: "2026-08-13T16:41:55Z", label: "Build and test", status: "done" },
      { at: "2026-08-13T16:43:40Z", label: "Publish artifact b-1.4.7", status: "done" },
    ],
  },
  {
    id: "pay-setup-0131",
    appId: "paygate",
    action: "Create Harness project, connector and pipeline",
    targetSystem: "harness",
    status: "success",
    triggeredById: "p-jonas",
    startedAt: "2026-08-08T13:02:10Z",
    endedAt: "2026-08-08T13:05:44Z",
    steps: [
      { at: "2026-08-08T13:02:10Z", label: "Validate inputs", status: "done" },
      { at: "2026-08-08T13:02:40Z", label: "Create project paygate", status: "done" },
      { at: "2026-08-08T13:03:35Z", label: "Create connector meridian-git", status: "done" },
      { at: "2026-08-08T13:05:44Z", label: "Create pipeline paygate-ci", status: "done" },
    ],
  },
  {
    id: "tfe-run-8812",
    appId: "paygate",
    action: "Apply workspace paygate-dev",
    targetSystem: "tfe",
    status: "success",
    statusLabel: "14 resources created",
    triggeredById: "p-sam",
    startedAt: "2026-08-12T07:11:00Z",
    endedAt: "2026-08-12T07:18:22Z",
    steps: [
      { at: "2026-08-12T07:11:00Z", label: "Plan", status: "done", detail: "14 to create" },
      { at: "2026-08-12T07:14:03Z", label: "Apply", status: "done" },
      { at: "2026-08-12T07:18:22Z", label: "Outputs written", status: "done" },
    ],
  },
  {
    id: "led-deploy-0021",
    appId: "ledgerline",
    action: "Deploy to DEV",
    targetSystem: "harness",
    status: "success",
    statusLabel: "First successful DEV deployment",
    triggeredById: "p-tomas",
    startedAt: "2026-08-02T13:55:00Z",
    endedAt: "2026-08-02T14:02:41Z",
    inputs: { artifact: "b-2.1.0", environment: "dev", taskDefinition: "ledgerline:6" },
    steps: [
      { at: "2026-08-02T13:55:00Z", label: "Queued", status: "done" },
      { at: "2026-08-02T13:55:20Z", label: "Fetch artifact b-2.1.0", status: "done" },
      { at: "2026-08-02T13:56:02Z", label: "Resolve secrets", status: "done" },
      { at: "2026-08-02T13:59:48Z", label: "Deploy service", status: "done" },
      {
        at: "2026-08-02T14:02:41Z",
        label: "Health check",
        status: "done",
        detail: "200 OK, 5 of 5 checks",
      },
    ],
  },
];

export function getFixtureRun(id: string): Run | undefined {
  return RUNS.find((run) => run.id === id);
}

export function runsFor(appId: AppId): Run[] {
  return RUNS.filter((run) => run.appId === appId);
}

// ---------------------------------------------------------------------------
// Tickets / requests (fictional)
// ---------------------------------------------------------------------------

export interface Ticket {
  id: string;
  appId: AppId;
  system: SourceId;
  title: string;
  status: "pending-approval" | "in-progress" | "resolved";
  openedAt: string;
  waitingOnId?: string;
}

export const TICKETS: Ticket[] = [
  {
    id: "REQ-105031",
    appId: "paygate",
    system: "servicenow",
    title: "Vault policy: grant paygate-dev read on paygate/dev/*",
    status: "pending-approval",
    openedAt: "2026-08-11T15:02:00Z",
    waitingOnId: "p-elena",
  },
  {
    id: "REQ-104812",
    appId: "paygate",
    system: "sailpoint",
    title: "Group membership: meridian-developers",
    status: "resolved",
    openedAt: "2026-08-06T14:20:00Z",
  },
  {
    id: "REQ-105102",
    appId: "fieldnotes",
    system: "sailpoint",
    title: "Group membership: aurora-developers",
    status: "pending-approval",
    openedAt: "2026-08-13T13:20:00Z",
    waitingOnId: "p-elena",
  },
];

export function ticketsFor(appId: AppId): Ticket[] {
  return TICKETS.filter((ticket) => ticket.appId === appId);
}

// ---------------------------------------------------------------------------
// Diagnosis cases (keyed by failed run id)
// ---------------------------------------------------------------------------

export interface Hypothesis {
  id: string;
  title: string;
  confidence: "high" | "medium" | "ruled-out";
  summary: string;
  evidenceFor: Evidence[];
  evidenceAgainst: Evidence[];
  unknowns: string[];
  confirmBy?: string;
  note?: string;
}

export interface DiagnosisCase {
  runId: string;
  appId: AppId;
  failedStage: string;
  errorClass: string;
  summary: string;
  hypotheses: Hypothesis[];
  ownership: { layer: string; ownerId: string; teamId: string }[];
  supportRoute: { teamId: string; note: string };
}

export const DIAGNOSIS_CASES: DiagnosisCase[] = [
  {
    runId: "pay-deploy-0142",
    appId: "paygate",
    failedStage: "Resolve secrets",
    errorClass: "SecretNotFound",
    summary:
      "The deployment failed before any container started: the task definition asks Vault for a secret path that does not exist.",
    hypotheses: [
      {
        id: "h1",
        title: "Task definition points at a secret path that does not exist",
        confidence: "high",
        summary:
          "Task definition revision 14 references 'paygate/dev/db-password'. Vault stores the database password at 'paygate/dev/db/password'. The reference was renamed when the secret layout changed and the task definition was not updated.",
        evidenceFor: [
          {
            id: "ev-d1-error",
            label: "Error line from the failed run",
            source: "harness",
            kind: "observed",
            externalId: "pay-deploy-0142",
            retrievedAt: "2026-08-14T09:13:00Z",
            note: "SecretNotFound: paygate/dev/db-password",
          },
          {
            id: "ev-d1-taskdef",
            label: "Task definition rev 14, secrets block",
            source: "harness",
            kind: "observed",
            externalId: "paygate:14",
            retrievedAt: "2026-08-14T09:13:20Z",
            note: "references paygate/dev/db-password",
          },
          {
            id: "ev-d1-vault",
            label: "Vault path listing for paygate/dev",
            source: "vault",
            kind: "observed",
            externalId: "paygate/dev/*",
            retrievedAt: "2026-08-14T09:10:00Z",
            note: "contains db/password, no db-password",
          },
        ],
        evidenceAgainst: [],
        unknowns: [],
        confirmBy:
          "Compare the secrets block of task definition rev 14 with the Vault listing above.",
      },
      {
        id: "h2",
        title: "The execution role is not allowed to read the secret",
        confidence: "medium",
        summary:
          "The same error class appeared on Ledgerline 12 days ago, where the cause was a missing Vault policy capability. Here the current policy document already grants read on paygate/dev/*, which contradicts this hypothesis, but the granting change REQ-105031 is still pending so the snapshot may predate enforcement.",
        evidenceFor: [
          {
            id: "ev-d2-prev",
            label: "Prior incident CHG-3381 on ledgerline",
            source: "servicenow",
            kind: "observed",
            externalId: "CHG-3381",
            retrievedAt: "2026-08-14T09:15:00Z",
            note: "Same error class, root cause was a policy gap",
          },
        ],
        evidenceAgainst: [
          {
            id: "ev-d2-policy",
            label: "Vault policy document for paygate-dev",
            source: "vault",
            kind: "observed",
            externalId: "policy/paygate-dev",
            retrievedAt: "2026-08-14T09:10:00Z",
            note: "grants read on paygate/dev/*",
          },
        ],
        unknowns: [
          "Atlas cannot read Vault audit logs, so actual secret read attempts are not observable.",
        ],
        note: "Weakened by contradicting evidence. Revisit if the path correction alone does not fix the run.",
      },
      {
        id: "h3",
        title: "Artifact missing from the registry",
        confidence: "ruled-out",
        summary: "Ruled out: artifact b-1.4.7 is present and was fetched successfully at 09:11.",
        evidenceFor: [],
        evidenceAgainst: [
          {
            id: "ev-d3-artifact",
            label: "Artifact feed",
            source: "harness",
            kind: "observed",
            externalId: "b-1.4.7",
            retrievedAt: "2026-08-14T09:05:00Z",
          },
        ],
        unknowns: [],
      },
    ],
    ownership: [
      { layer: "Task definition and pipeline", ownerId: "p-maya", teamId: "t-meridian" },
      { layer: "Vault policy and secret paths", ownerId: "p-sam", teamId: "t-foundations" },
    ],
    supportRoute: {
      teamId: "t-foundations",
      note: "Reference run pay-deploy-0142 and request REQ-105031 when escalating.",
    },
  },
];

export function diagnosisForRun(runId: string): DiagnosisCase | undefined {
  return DIAGNOSIS_CASES.find((c) => c.runId === runId);
}

export function diagnosesForApp(appId: AppId): DiagnosisCase[] {
  return DIAGNOSIS_CASES.filter((c) => c.appId === appId);
}

// ---------------------------------------------------------------------------
// Scaffolder intents and simulated run plans
// ---------------------------------------------------------------------------

export type IntentId = "scaffold-workload" | "deploy-dev" | "request-access";

export interface IntentDef {
  id: IntentId;
  title: string;
  description: string;
  executedBy: SourceId;
  risk: "L2" | "L3";
  riskNote: string;
}

export const SCAFFOLDER_INTENTS: IntentDef[] = [
  {
    id: "scaffold-workload",
    title: "Scaffold a new workload",
    description:
      "Create a service from the golden path template, wired into the team's account, repository and pipeline conventions.",
    executedBy: "harness",
    risk: "L2",
    riskNote: "Creates new DEV resources. Logged and attributed to you.",
  },
  {
    id: "deploy-dev",
    title: "Trigger a DEV deployment",
    description:
      "Deploy a selected artifact to the DEV environment through the application's Harness pipeline.",
    executedBy: "harness",
    risk: "L3",
    riskNote: "Changes the DEV environment. Requires explicit confirmation.",
  },
  {
    id: "request-access",
    title: "Request an access package",
    description:
      "Submit a group membership request for the application's team. Approval happens in SailPoint; Atlas tracks the result.",
    executedBy: "sailpoint",
    risk: "L2",
    riskNote: "Submits a request. Approval stays with the approver in SailPoint.",
  },
];

export interface SimRunPlan {
  action: string;
  targetSystem: SourceId;
  steps: string[];
  terminal: "success" | "waiting-approval";
  terminalLabel: string;
}

export const SIM_RUN_PLANS: Record<IntentId, SimRunPlan> = {
  "scaffold-workload": {
    action: "Scaffold a new workload",
    targetSystem: "harness",
    steps: [
      "Validate inputs",
      "Create repository skeleton",
      "Create Harness project and pipeline",
      "Register application profile",
      "Attach evidence",
    ],
    terminal: "success",
    terminalLabel: "Workload scaffolded",
  },
  "deploy-dev": {
    action: "Deploy to DEV",
    targetSystem: "harness",
    steps: [
      "Queue deployment",
      "Fetch artifact",
      "Render task definition",
      "Resolve secrets",
      "Deploy service",
      "Run health check",
    ],
    terminal: "success",
    terminalLabel: "Deployment finished (simulated, assumes the secret correction was applied)",
  },
  "request-access": {
    action: "Request an access package",
    targetSystem: "sailpoint",
    steps: ["Validate request", "Submit to SailPoint", "Await approver decision"],
    terminal: "waiting-approval",
    terminalLabel: "Waiting for approval by E. Petrova in SailPoint",
  },
};

/** Existing service names used by the deterministic naming-conflict preflight. */
export const EXISTING_SERVICE_NAMES = [
  "paygate",
  "paygate-web",
  "paygate-worker",
  "ledgerline",
  "ledgerline-reports",
  "fieldnotes",
];

export interface ArtifactBuild {
  id: string;
  appId: AppId;
  createdAt: string;
  ciRunId: string;
  checks: "green" | "failed";
}

export const ARTIFACT_BUILDS: ArtifactBuild[] = [
  {
    id: "b-1.4.7",
    appId: "paygate",
    createdAt: "2026-08-13T16:44:00Z",
    ciRunId: "pay-ci-0139",
    checks: "green",
  },
  {
    id: "b-1.4.6",
    appId: "paygate",
    createdAt: "2026-08-12T15:02:00Z",
    ciRunId: "pay-ci-0137",
    checks: "green",
  },
  {
    id: "b-1.4.5",
    appId: "paygate",
    createdAt: "2026-08-12T09:18:00Z",
    ciRunId: "pay-ci-0135",
    checks: "failed",
  },
  {
    id: "b-2.1.0",
    appId: "ledgerline",
    createdAt: "2026-08-01T10:20:00Z",
    ciRunId: "led-ci-0020",
    checks: "green",
  },
];

export function buildsFor(appId: AppId): ArtifactBuild[] {
  return ARTIFACT_BUILDS.filter((b) => b.appId === appId);
}
