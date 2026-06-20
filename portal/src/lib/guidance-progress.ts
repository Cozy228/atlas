import { useCallback, useEffect, useState } from "react";

/**
 * Client-only guidance progress. Stored in localStorage, scoped per guidance.
 * This is a local convenience marker for the person at the keyboard — it is not a
 * system of record and is never sent anywhere. Task keys are `${stepId}:${taskId}`.
 */

const STORAGE_KEY = "atlas:guidance-progress";

type ProgressEntry = { tasks: string[]; steps: string[] };
type ProgressMap = Record<string, ProgressEntry>;

function readAll(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as ProgressMap) : {};
  } catch {
    return {};
  }
}

function writeAll(map: ProgressMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage may be disabled (private mode); silently no-op.
  }
}

export type GuidanceProgress = {
  hydrated: boolean;
  completedTasks: ReadonlySet<string>;
  completedSteps: ReadonlySet<string>;
  toggleTask: (taskKey: string) => void;
  toggleStep: (stepId: string) => void;
  reset: () => void;
};

export function taskKey(stepId: string, taskId: string): string {
  return `${stepId}:${taskId}`;
}

/** Completed step ids per guidance, read once (client-only). For index surfaces
 * that summarise "what you have already started" without mounting each flow. */
export function readAllProgress(): Record<string, ReadonlySet<string>> {
  const all = readAll();
  const out: Record<string, ReadonlySet<string>> = {};
  for (const [id, entry] of Object.entries(all)) {
    out[id] = new Set(entry.steps ?? []);
  }
  return out;
}

export function useGuidanceProgress(guidanceId: string): GuidanceProgress {
  const [state, setState] = useState<{ tasks: Set<string>; steps: Set<string> }>(() => ({
    tasks: new Set(),
    steps: new Set(),
  }));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const entry = readAll()[guidanceId];
    setState({ tasks: new Set(entry?.tasks ?? []), steps: new Set(entry?.steps ?? []) });
    setHydrated(true);
  }, [guidanceId]);

  useEffect(() => {
    if (!hydrated) return;
    const all = readAll();
    all[guidanceId] = { tasks: [...state.tasks], steps: [...state.steps] };
    writeAll(all);
  }, [hydrated, guidanceId, state]);

  const toggleTask = useCallback((key: string) => {
    setState((prev) => {
      const tasks = new Set(prev.tasks);
      if (tasks.has(key)) tasks.delete(key);
      else tasks.add(key);
      return { tasks, steps: prev.steps };
    });
  }, []);

  const toggleStep = useCallback((stepId: string) => {
    setState((prev) => {
      const steps = new Set(prev.steps);
      if (steps.has(stepId)) steps.delete(stepId);
      else steps.add(stepId);
      return { tasks: prev.tasks, steps };
    });
  }, []);

  const reset = useCallback(() => {
    setState({ tasks: new Set(), steps: new Set() });
  }, []);

  return {
    hydrated,
    completedTasks: state.tasks,
    completedSteps: state.steps,
    toggleTask,
    toggleStep,
    reset,
  };
}
