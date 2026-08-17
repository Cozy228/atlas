/**
 * Prototype `opus` — derived reads
 * ================================
 * Everything the surfaces compute from the fixture record set. Kept pure and
 * dependency-free so the ranking rules are testable and the same numbers appear
 * on every surface.
 */
import { sinceNow } from "./clock";
import type {
  Application,
  AttentionItem,
  Diagnosis,
  Fact,
  JourneyStep,
  Provenance,
  Run,
  StepState,
} from "./types";

/** Worst-first ladder used to pick the one step that is holding the journey. */
const BLOCKING_ORDER: ReadonlyArray<StepState> = ["failed", "blocked", "waiting", "running"];

/** States that mean "this step will never need doing on this branch". */
const OUT_OF_SCOPE: ReadonlyArray<StepState> = ["off-branch"];

export type JourneySummary = {
  /** Steps that apply to the chosen branch. */
  applicable: number;
  /** Complete with evidence or a declaration. */
  complete: number;
  /** Deliberately not done under a recorded exception; neither passing nor failing. */
  waived: number;
  outstanding: number;
  /** 0-1 over applicable steps. Never used as the only signal: it hides the blocker. */
  progress: number;
  /** The single step a developer should look at, or undefined when nothing blocks. */
  blockingStep?: JourneyStep;
  /** Phase the blocking step sits in, else the last phase with a complete step. */
  currentPhaseId: string;
  byState: Readonly<Record<StepState, number>>;
};

export function journeySummary(app: Application): JourneySummary {
  const steps = app.journey.steps;
  const byState = steps.reduce<Record<string, number>>((acc, step) => {
    acc[step.state] = (acc[step.state] ?? 0) + 1;
    return acc;
  }, {});

  const applicableSteps = steps.filter((step) => !OUT_OF_SCOPE.includes(step.state));
  const complete = applicableSteps.filter(
    (step) => step.state === "verified" || step.state === "confirmed",
  ).length;
  const waived = applicableSteps.filter((step) => step.state === "waived").length;

  let blockingStep: JourneyStep | undefined;
  for (const state of BLOCKING_ORDER) {
    blockingStep = applicableSteps.find((step) => step.state === state);
    if (blockingStep) break;
  }

  const lastComplete = [...applicableSteps]
    .reverse()
    .find((step) => step.state === "verified" || step.state === "confirmed");

  return {
    applicable: applicableSteps.length,
    complete,
    waived,
    outstanding: applicableSteps.length - complete - waived,
    progress: applicableSteps.length === 0 ? 0 : (complete + waived) / applicableSteps.length,
    blockingStep,
    currentPhaseId:
      blockingStep?.phaseId ?? lastComplete?.phaseId ?? app.journey.phases[0]?.id ?? "identify",
    byState: byState as Record<StepState, number>,
  };
}

/**
 * Attention ranking. Urgency is a fixed ladder, not a score: a failure always
 * outranks a wait, and a wait always outranks an advisory. Within one rung the
 * oldest item comes first, because age is the only honest tie-breaker.
 */
const URGENCY: Readonly<Record<AttentionItem["kind"], number>> = {
  failure: 0,
  blocked: 1,
  waiting: 2,
  advisory: 3,
  "data-quality": 4,
};

export function attentionItems(app: Application): ReadonlyArray<AttentionItem> {
  const items: AttentionItem[] = [];

  for (const step of app.journey.steps) {
    if (step.state === "failed") {
      const run = app.runs.find((candidate) => candidate.diagnosisId !== undefined);
      items.push({
        id: `att-${step.id}`,
        kind: "failure",
        urgency: URGENCY.failure,
        title: `${step.title} failed`,
        why:
          run === undefined
            ? "The last attempt failed and has not been diagnosed."
            : `${run.id} failed at "${failedStageLabel(run)}". Atlas has a diagnosis with ranked causes.`,
        holder: step.holder,
        since: run?.startedAt,
        stepId: step.id,
        action: step.nextAction,
      });
    }
    if (step.state === "blocked") {
      const blocker = step.blockers?.[0];
      items.push({
        id: `att-${step.id}`,
        kind: "blocked",
        urgency: URGENCY.blocked,
        title: `${step.title} is blocked`,
        why: blocker?.summary ?? "A prerequisite is not met.",
        holder: blocker?.holder ?? step.holder,
        since: blocker?.holder.since ?? step.holder.since,
        stepId: step.id,
        action: step.nextAction,
      });
    }
    if (step.state === "waiting") {
      items.push({
        id: `att-${step.id}`,
        kind: "waiting",
        urgency: URGENCY.waiting,
        title: `${step.title} is waiting on someone else`,
        why: step.holder.releasedBy ?? "Waiting on a decision outside Atlas.",
        holder: step.holder,
        since: step.holder.since,
        stepId: step.id,
        action: step.nextAction,
      });
    }
  }

  for (const advisory of app.advisories) {
    if (advisory.severity !== "attention") continue;
    items.push({
      id: `att-${advisory.id}`,
      kind: "advisory",
      urgency: URGENCY.advisory,
      title: advisory.label,
      why: advisory.summary,
      holder: { kind: "system", label: "Platform change" },
      since: advisory.at,
    });
  }

  for (const fact of app.context) {
    if (fact.caveat === undefined) continue;
    if (fact.freshness === "fresh") continue;
    items.push({
      id: `att-${fact.id}`,
      kind: "data-quality",
      urgency: URGENCY["data-quality"],
      title: `${fact.label} may be out of date`,
      why: fact.caveat,
      holder: { kind: "system", label: "Context quality" },
      since: fact.retrievedAt,
    });
  }

  return items.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency - b.urgency;
    const ageA = a.since === undefined ? 0 : sinceNow(a.since);
    const ageB = b.since === undefined ? 0 : sinceNow(b.since);
    return ageB - ageA;
  });
}

export function failedStageLabel(run: Run): string {
  return run.stages.find((stage) => stage.state === "failed")?.label ?? "an unnamed stage";
}

export function stepById(app: Application, stepId: string | undefined): JourneyStep | undefined {
  if (stepId === undefined) return undefined;
  return app.journey.steps.find((step) => step.id === stepId);
}

export function runById(app: Application, runId: string | undefined): Run | undefined {
  if (runId === undefined) return undefined;
  return app.runs.find((run) => run.id === runId);
}

/** The diagnosis for a run, or the application's only open diagnosis. */
export function resolveDiagnosis(
  app: Application,
  runId: string | undefined,
): Diagnosis | undefined {
  if (runId !== undefined) {
    const match = app.diagnoses.find((diagnosis) => diagnosis.runId === runId);
    if (match) return match;
  }
  return app.diagnoses[0];
}

export function intentById(app: Application, intentId: string | undefined) {
  if (intentId === undefined) return undefined;
  return app.intents.find((intent) => intent.id === intentId);
}

/** How much of the shown context is observed rather than assumed. */
export function provenanceMix(facts: ReadonlyArray<Fact>): Readonly<Record<Provenance, number>> {
  return facts.reduce<Record<Provenance, number>>(
    (acc, fact) => {
      acc[fact.provenance] += 1;
      return acc;
    },
    { observed: 0, derived: 0, declared: 0, atlas: 0, unknown: 0 },
  );
}

/** Steps grouped in phase order, keeping fixture order inside each phase. */
export function stepsByPhase(app: Application) {
  return app.journey.phases.map((phase) => ({
    phase,
    steps: app.journey.steps.filter((step) => step.phaseId === phase.id),
  }));
}
