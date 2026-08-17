/**
 * Prototype `opus` — fixture types
 * ================================
 * Deterministic, fictional data model for the `/prototype/opus` exploration.
 * Nothing here is wired to a real system; every record is invented.
 *
 * The model is built around one idea: no value is shown without its
 * provenance. `Fact` is therefore the smallest unit of the whole prototype and
 * every surface renders facts, never bare strings.
 */

/** How Atlas came to know a value. Rendered as a letter mark, never colour alone. */
export type Provenance =
  /** Read from a source system. */
  | "observed"
  /** Computed by Atlas from other observed facts. */
  | "derived"
  /** Asserted by a person, with attribution. */
  | "declared"
  /** Atlas' own experience state (journey selection, step order, evidence rules). */
  | "atlas"
  /** Source unreachable, unmapped, or not permitted. */
  | "unknown";

export type Freshness = "fresh" | "aging" | "stale" | "unknown";

export type SystemKind =
  | "atlas"
  | "registry"
  | "access"
  | "itsm"
  | "iac"
  | "delivery"
  | "secrets"
  | "artifacts"
  | "cloud"
  | "scm";

/**
 * A source system Atlas reads from or delegates to. Labels are generic platform
 * roles, not vendor products, so the prototype stays publishable.
 */
export type SourceSystem = {
  id: string;
  label: string;
  kind: SystemKind;
  /** The team accountable for the system itself (not for the application). */
  stewardTeam: string;
  /** Fictional record locator shown in evidence, never a live URL. */
  recordSpace: string;
};

/** A single value plus everything needed to trust it. */
export type Fact = {
  id: string;
  label: string;
  value: string;
  provenance: Provenance;
  /** Omitted for `atlas` and `unknown` facts. */
  systemId?: string;
  /** Identifier of the record in the source system. */
  externalId?: string;
  /** ISO timestamp; relative labels are computed against `FIXTURE_NOW`. */
  retrievedAt?: string;
  freshness?: Freshness;
  /** How the value was resolved. Shown verbatim in the evidence panel. */
  method?: string;
  /** Data-quality caveat. Rendered as an attention note, never hidden. */
  caveat?: string;
  /** Render the value in the mono identifier style. */
  mono?: boolean;
  /** Person or group attribution for `declared` facts. */
  declaredBy?: string;
};

export type Holder = {
  /** Who the item is currently waiting on. */
  kind: "you" | "your-team" | "other-team" | "system";
  label: string;
  /** ISO timestamp the wait started. */
  since?: string;
  /** What unblocks it, in one sentence. */
  releasedBy?: string;
};

export type StepState =
  /** Complete, with evidence read from a source system. */
  | "verified"
  /** Complete, asserted by a person. */
  | "confirmed"
  /** Running in a source system right now. */
  | "running"
  /** Complete enough to start, nothing blocking. */
  | "ready"
  /** Waiting on a person or team outside your control. */
  | "waiting"
  /** Cannot start: a prerequisite is unmet or context is missing. */
  | "blocked"
  /** Last attempt failed. */
  | "failed"
  /** Deliberately not done, under a recorded exception. */
  | "waived"
  /** Not reachable on the chosen branch. */
  | "off-branch"
  | "not-started";

export type Evidence = {
  id: string;
  label: string;
  /** The value that proves it: run id, request id, digest, validation output. */
  value: string;
  systemId?: string;
  recordedAt: string;
  provenance: Provenance;
  mono?: boolean;
};

export type Blocker = {
  id: string;
  summary: string;
  /** Step id that must resolve first, when the blocker is internal to the journey. */
  dependsOnStepId?: string;
  holder: Holder;
};

export type DecisionOption = {
  id: string;
  label: string;
  detail: string;
  recommended?: boolean;
  /** Why Atlas recommends or excludes it. */
  rationale: string;
};

export type Decision = {
  question: string;
  options: ReadonlyArray<DecisionOption>;
  chosenOptionId: string;
  decidedBy: string;
  decidedAt: string;
  /** What downstream steps the choice determines. */
  determines: string;
};

export type NextAction =
  | { kind: "diagnose"; label: string; runId: string }
  | { kind: "request"; label: string; intentId: string }
  | { kind: "confirm"; label: string; note: string }
  | { kind: "external"; label: string; systemId: string; externalId: string }
  | { kind: "wait"; label: string; note: string };

export type JourneyStep = {
  id: string;
  phaseId: string;
  title: string;
  /** One sentence: what "done" means for this step. */
  intent: string;
  state: StepState;
  /** Who is accountable for moving it. */
  holder: Holder;
  /** The system that performs the work; `atlas` when Atlas owns it. */
  executedBy: string;
  /** What Atlas contributes. Keeps the delegation boundary visible. */
  atlasRole: string;
  prerequisiteIds?: ReadonlyArray<string>;
  facts?: ReadonlyArray<Fact>;
  evidence?: ReadonlyArray<Evidence>;
  blockers?: ReadonlyArray<Blocker>;
  decision?: Decision;
  /** Recorded exception that made a required step skippable. */
  exception?: {
    reason: string;
    reference: string;
    approvedBy: string;
    expiresAt: string;
  };
  /** What to do if the normal path cannot complete. */
  fallback?: string;
  nextAction?: NextAction;
  /** Set when the step exists only on a branch that was not taken. */
  offBranchReason?: string;
};

export type JourneyPhase = {
  id: string;
  label: string;
  /** The outcome the phase delivers, in the developer's words. */
  outcome: string;
};

export type Journey = {
  id: string;
  goldenPathId: string;
  goldenPathLabel: string;
  version: string;
  owner: string;
  reviewedAt: string;
  /** Completion criteria, verbatim from the golden path definition. */
  completionCriteria: ReadonlyArray<string>;
  startedAt: string;
  phases: ReadonlyArray<JourneyPhase>;
  steps: ReadonlyArray<JourneyStep>;
};

export type RunStageState = "passed" | "failed" | "running" | "skipped" | "pending";

export type RunStage = {
  id: string;
  label: string;
  state: RunStageState;
  durationMs?: number;
  /** Terminal message from the source system, quoted verbatim. */
  output?: string;
};

export type Run = {
  id: string;
  label: string;
  kind: "deployment" | "infrastructure" | "build" | "platform-action";
  systemId: string;
  environment: string;
  triggeredBy: string;
  /** Set when Atlas triggered it on the user's behalf. */
  viaAtlasAction?: string;
  startedAt: string;
  durationMs: number;
  result: "succeeded" | "failed" | "running" | "waiting";
  stages: ReadonlyArray<RunStage>;
  /** Present for failed runs that have a diagnosis. */
  diagnosisId?: string;
};

export type EvidenceRef = {
  label: string;
  value: string;
  systemId?: string;
  retrievedAt: string;
  provenance: Provenance;
  mono?: boolean;
};

export type Cause = {
  id: string;
  claim: string;
  /** 0-1. Rendered as a labelled band plus the numeric value, never colour alone. */
  confidence: number;
  confidenceLabel: "high" | "moderate" | "low";
  /** Why the confidence is what it is. */
  reasoning: string;
  supporting: ReadonlyArray<EvidenceRef>;
  contradicting: ReadonlyArray<EvidenceRef>;
  /** What Atlas could not determine, and why. */
  unknowns: ReadonlyArray<string>;
  /** Team accountable for the domain this cause lives in. */
  ownerTeam: string;
};

export type RecoveryOption = {
  id: string;
  label: string;
  summary: string;
  /** Ordered, human-readable effect list. */
  effect: ReadonlyArray<string>;
  executedBy: string;
  risk: "none" | "low" | "medium";
  needsApprovalFrom?: string;
  /** Set when Atlas expects the option to fail while a cause is unresolved. */
  ineffectiveWhile?: string;
  recommended?: boolean;
  action?: NextAction;
};

export type CorrelatedChange = {
  id: string;
  label: string;
  systemId: string;
  at: string;
  /** Atlas' honest read of the relationship. */
  relation: "candidate" | "context" | "ruled-out";
  note: string;
};

export type Diagnosis = {
  id: string;
  runId: string;
  applicationId: string;
  /** The step in the journey the failure belongs to. */
  stepId: string;
  failedStageId: string;
  symptom: string;
  quotedError: string;
  scope: ReadonlyArray<string>;
  causes: ReadonlyArray<Cause>;
  changes: ReadonlyArray<CorrelatedChange>;
  /** Checks Atlas did not or could not perform. */
  notChecked: ReadonlyArray<{ label: string; reason: string }>;
  recovery: ReadonlyArray<RecoveryOption>;
};

export type ResolutionClass =
  /** Resolved from context; the user cannot change it here. */
  | "resolved"
  /** Atlas has a recommendation the user may override. */
  | "recommended"
  /** Genuinely needs a person; Atlas explains why it cannot decide. */
  | "decision"
  /** Missing or contradictory context stops the request. */
  | "blocked";

export type ResolutionField = {
  id: string;
  label: string;
  /** Field name in the payload sent to the source system. */
  payloadKey: string;
  value: string;
  resolutionClass: ResolutionClass;
  provenance: Provenance;
  systemId?: string;
  externalId?: string;
  retrievedAt?: string;
  /** How it was resolved, or why it cannot be. Always present: this is the point. */
  reason: string;
  mono?: boolean;
  /** Choices for `decision` and `recommended` fields. */
  options?: ReadonlyArray<{ id: string; label: string; detail: string; recommended?: boolean }>;
  /** Conflicting sources, shown when context is ambiguous. */
  conflict?: ReadonlyArray<{ systemId: string; claim: string; retrievedAt: string }>;
  /** Who can supply what is missing. */
  missingOwner?: string;
};

export type ActionIntent = {
  id: string;
  label: string;
  /** What the developer wants, in their words. */
  intent: string;
  /** Atlas' plain statement of the governed operation behind the intent. */
  operation: string;
  riskLevel: "L1" | "L2" | "L3";
  executedBy: string;
  /** Endpoint-shaped destination, fictional. */
  destination: string;
  /** What Atlas will watch after handing off. */
  observes: ReadonlyArray<string>;
  /** Approval requirement, or null when the action needs none. */
  approval: { by: string; why: string } | null;
  fields: ReadonlyArray<ResolutionField>;
  /** Set when the request cannot be submitted at all. */
  blockedBy?: { summary: string; dependsOnStepId?: string; diagnosisId?: string; owner: string };
  /** Deterministic simulated execution. */
  simulation: {
    stages: ReadonlyArray<{
      id: string;
      label: string;
      actor: string;
      /** What the stage produces when it completes. */
      output: string;
      /** Terminal stages end the run in this state. */
      terminal?: "succeeded" | "waiting";
    }>;
    evidence: ReadonlyArray<Evidence>;
  };
};

export type Advisory = {
  id: string;
  label: string;
  summary: string;
  systemId: string;
  at: string;
  severity: "notice" | "attention";
};

/**
 * One thing the developer should look at, derived from journey state, advisories
 * and context quality. `urgency` is a fixed ladder rather than a score, so the
 * order is explainable: failure, blocked, waiting, advisory, data quality.
 */
export type AttentionItem = {
  id: string;
  kind: "failure" | "blocked" | "waiting" | "advisory" | "data-quality";
  urgency: number;
  title: string;
  /** Why it matters, in one sentence. */
  why: string;
  holder: Holder;
  since?: string;
  stepId?: string;
  action?: NextAction;
};

export type Application = {
  id: string;
  code: string;
  name: string;
  purpose: string;
  team: string;
  techLead: string;
  lifecycle: "onboarding" | "operating";
  workloadPattern: string;
  environments: ReadonlyArray<string>;
  /** Resolved application context, the ledger every surface shares. */
  context: ReadonlyArray<Fact>;
  journey: Journey;
  runs: ReadonlyArray<Run>;
  diagnoses: ReadonlyArray<Diagnosis>;
  intents: ReadonlyArray<ActionIntent>;
  advisories: ReadonlyArray<Advisory>;
  /** Roster used to fill "who" decisions from resolved context, not blank fields. */
  roster: ReadonlyArray<{ id: string; name: string; role: string; hasDevAccess: boolean }>;
};
