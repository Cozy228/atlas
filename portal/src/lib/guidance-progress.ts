import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Client-only guidance progress. Stored in localStorage, scoped per guidance.
 * This is a local convenience marker for the person at the keyboard — it is not a
 * system of record and is never sent anywhere. Task keys are `${stepId}:${taskId}`.
 *
 * Backed by a module-level external store read through `useSyncExternalStore`, so
 * SSR renders the empty server snapshot and the client swaps in the stored value
 * on hydration — no effect-driven setState, no hydration mismatch.
 */

const STORAGE_KEY = "atlas:guidance-progress";

type ProgressEntry = { tasks: string[]; steps: string[] };
type ProgressMap = Record<string, ProgressEntry>;

const EMPTY: ProgressMap = {};

function readAll(): ProgressMap {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as ProgressMap) : EMPTY;
  } catch {
    return EMPTY;
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

// ---- module-level store ----------------------------------------------------

let cache: ProgressMap | null = null;
const listeners = new Set<() => void>();

function current(): ProgressMap {
  if (cache === null) cache = readAll();
  return cache;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = readAll();
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function mutate(fn: (prev: ProgressMap) => ProgressMap) {
  cache = fn(current());
  writeAll(cache);
  for (const listener of listeners) listener();
}

function useStore(): ProgressMap {
  return useSyncExternalStore(subscribe, current, () => EMPTY);
}

/** False during SSR and the hydration render, true once mounted on the client. */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export type GuidanceProgress = {
  hydrated: boolean;
  completedTasks: ReadonlySet<string>;
  completedSteps: ReadonlySet<string>;
  toggleTask: (taskKey: string) => void;
  toggleStep: (stepId: string) => void;
  /** Set many task/step keys to explicit done states in one write (for cascades). */
  setProgress: (updates: {
    tasks?: Record<string, boolean>;
    steps?: Record<string, boolean>;
  }) => void;
  reset: () => void;
};

export function taskKey(stepId: string, taskId: string): string {
  return `${stepId}:${taskId}`;
}

/** Completed step ids per guidance, reactive (client-only). For index surfaces
 * that summarise "what you have already started" without mounting each flow. */
export function useAllProgress(): Record<string, ReadonlySet<string>> {
  const map = useStore();
  return useMemo(() => {
    const out: Record<string, ReadonlySet<string>> = {};
    for (const [id, entry] of Object.entries(map)) {
      out[id] = new Set(entry.steps ?? []);
    }
    return out;
  }, [map]);
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function useGuidanceProgress(guidanceId: string): GuidanceProgress {
  const map = useStore();
  const hydrated = useIsHydrated();
  const entry = map[guidanceId];

  const completedTasks = useMemo(() => new Set(entry?.tasks ?? []), [entry]);
  const completedSteps = useMemo(() => new Set(entry?.steps ?? []), [entry]);

  const toggleTask = useCallback(
    (key: string) =>
      mutate((prev) => {
        const e = prev[guidanceId] ?? { tasks: [], steps: [] };
        return { ...prev, [guidanceId]: { tasks: toggle(e.tasks, key), steps: e.steps } };
      }),
    [guidanceId],
  );

  const toggleStep = useCallback(
    (stepId: string) =>
      mutate((prev) => {
        const e = prev[guidanceId] ?? { tasks: [], steps: [] };
        return { ...prev, [guidanceId]: { tasks: e.tasks, steps: toggle(e.steps, stepId) } };
      }),
    [guidanceId],
  );

  const setProgress = useCallback<GuidanceProgress["setProgress"]>(
    (updates) =>
      mutate((prev) => {
        const e = prev[guidanceId] ?? { tasks: [], steps: [] };
        const apply = (list: string[], changes?: Record<string, boolean>) => {
          if (!changes) return list;
          const set = new Set(list);
          for (const [key, done] of Object.entries(changes)) {
            if (done) set.add(key);
            else set.delete(key);
          }
          return [...set];
        };
        return {
          ...prev,
          [guidanceId]: {
            tasks: apply(e.tasks, updates.tasks),
            steps: apply(e.steps, updates.steps),
          },
        };
      }),
    [guidanceId],
  );

  const reset = useCallback(
    () => mutate((prev) => ({ ...prev, [guidanceId]: { tasks: [], steps: [] } })),
    [guidanceId],
  );

  return {
    hydrated,
    completedTasks,
    completedSteps,
    toggleTask,
    toggleStep,
    setProgress,
    reset,
  };
}
