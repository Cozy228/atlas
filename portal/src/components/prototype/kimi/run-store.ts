/**
 * Prototype "kimi" — session store for simulated action runs.
 *
 * Triggering a governed action in the scaffolder (or a recovery action in
 * diagnosis) creates a Run object that lives in sessionStorage. This keeps
 * direct URLs and reloads working within the tab session without any backend.
 * Fixture runs (fixtures.ts) remain the deterministic baseline; simulated runs
 * are always labelled `simulated`.
 */

import type { AppId, IntentId, Run, RunStep } from "./fixtures";
import { CURRENT_USER, PROTOTYPE_NOW, SIM_RUN_PLANS } from "./fixtures";

const STORAGE_KEY = "atlas-proto-kimi-runs-v1";

function canStore(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
  } catch {
    return false;
  }
}

export function loadSimulatedRuns(): Run[] {
  if (!canStore()) return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Run[]) : [];
  } catch {
    return [];
  }
}

function persist(runs: Run[]): void {
  if (!canStore()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {
    // Storage full or blocked: the run simply will not survive a reload.
  }
}

export function getSimulatedRun(id: string): Run | undefined {
  return loadSimulatedRuns().find((run) => run.id === id);
}

export function saveSimulatedRun(run: Run): void {
  const runs = loadSimulatedRuns();
  const index = runs.findIndex((existing) => existing.id === run.id);
  if (index >= 0) runs[index] = run;
  else runs.push(run);
  persist(runs);
}

/**
 * Create a new simulated run for an intent. IDs and timestamps derive from the
 * number of runs already created this session, so the sequence is deterministic
 * within a session and never collides with fixture run IDs.
 */
export function createSimulatedRun(
  intentId: IntentId,
  appId: AppId,
  inputs: Record<string, string>,
): Run {
  const plan = SIM_RUN_PLANS[intentId];
  const sequence = loadSimulatedRuns().length + 1;
  const id = `sim-run-${String(sequence).padStart(3, "0")}`;
  const startedAt = new Date(Date.parse(PROTOTYPE_NOW) + sequence * 60_000).toISOString();
  const steps: RunStep[] = plan.steps.map((label, index) => ({
    at: startedAt,
    label,
    status: index === 0 ? "running" : "pending",
  }));
  const run: Run = {
    id,
    appId,
    action: plan.action,
    targetSystem: plan.targetSystem,
    status: "running",
    triggeredById: CURRENT_USER.id,
    startedAt,
    steps,
    inputs,
    simulated: true,
    intentId,
  };
  saveSimulatedRun(run);
  return run;
}

/**
 * Advance an in-progress simulated run by one step. Returns the updated run,
 * or the run unchanged when it is already terminal. Callers persist the
 * result via saveSimulatedRun.
 */
export function advanceSimulatedRun(run: Run, intentId: IntentId): Run {
  if (run.status !== "running" && run.status !== "queued") return run;
  const plan = SIM_RUN_PLANS[intentId];
  const activeIndex = run.steps.findIndex((step) => step.status === "running");
  if (activeIndex < 0) return run;

  const now = new Date(Date.parse(run.startedAt) + (activeIndex + 1) * 47_000).toISOString();
  const steps = run.steps.map((step, index): RunStep => {
    if (index < activeIndex) return { ...step, status: "done" };
    if (index === activeIndex) return { ...step, status: "done", at: now };
    if (index === activeIndex + 1) return { ...step, status: "running", at: now };
    return step;
  });

  const finished = activeIndex === run.steps.length - 1;
  if (!finished) return { ...run, steps };

  return {
    ...run,
    steps,
    status: plan.terminal,
    statusLabel: plan.terminalLabel,
    endedAt: plan.terminal === "waiting-approval" ? undefined : now,
  };
}
