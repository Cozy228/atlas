/**
 * The lifecycle-plane refresh schedule (Step 2, M2/M10 — the flagged gap closed).
 *
 * `refreshGraphSnapshots` is DERIVATION on the lifecycle plane: it warms every
 * source root's snapshot and derives change events inline at each transition (no
 * free-running worker — M10). This module is its production scheduler: gate logic
 * (`resolveGraphRefreshGate`) + a schedule primitive (`scheduleGraphRefresh`) that
 * runs one pass shortly after boot, then on an interval. The Nitro plugin
 * (`server/plugins/graphRefresh.ts`) is a thin wire over these two.
 *
 * Kept as a plain, dependency-injected module (not the plugin file) so it is unit
 * testable without a Nitro runtime, real timers, or the network — the plugin only
 * supplies `process.env`, the live `refreshGraphSnapshots`, and the pino logger.
 */
import { shouldMockData } from "../devMocks/shouldMock";

/** Recommended cadence an operator sets `GRAPH_REFRESH_INTERVAL_MS` to (15 min).
 *  Exported so infra/docs reference one number; the schedule is opt-in (absent env
 *  ⇒ no timer), so this is a suggested value, not a silent default-on. */
export const DEFAULT_GRAPH_REFRESH_INTERVAL_MS = 15 * 60 * 1000;

/** Let boot settle before the first crawl; never longer than the interval itself. */
export const INITIAL_GRAPH_REFRESH_DELAY_MS = 5 * 1000;

export type GraphRefreshGate =
  | { enabled: false; reason: string }
  | { enabled: true; intervalMs: number };

/**
 * Decide whether — and how often — the periodic refresh runs, from the process
 * env alone (pure). The schedule hits real source systems, so it is conservative:
 *
 *  - `NODE_ENV === "test"` or `VITEST` set → never (belt-and-suspenders; Nitro
 *    itself is not even mounted under vitest, but the gate refuses regardless).
 *  - DEV_MOCKS mock mode (`shouldMockData`) → skip: warming snapshots would crawl
 *    the in-process MSW fixtures, which is pointless churn, not real derivation.
 *    Mirrors how the dev seam gates other server-side behavior.
 *  - `GRAPH_REFRESH_INTERVAL_MS` is the explicit enable + cadence switch: absent,
 *    `0`, negative, or non-numeric → no timer (opt-in). A positive number → run at
 *    that cadence. Operators set it to {@link DEFAULT_GRAPH_REFRESH_INTERVAL_MS}.
 */
export function resolveGraphRefreshGate(env: Record<string, string | undefined>): GraphRefreshGate {
  if (env.NODE_ENV === "test" || env.VITEST) {
    return { enabled: false, reason: "test runtime" };
  }
  if (shouldMockData(env)) {
    return {
      enabled: false,
      reason: "DEV_MOCKS mock mode (a refresh pass would only crawl MSW fixtures)",
    };
  }
  const raw = env.GRAPH_REFRESH_INTERVAL_MS;
  if (raw === undefined) {
    return { enabled: false, reason: "GRAPH_REFRESH_INTERVAL_MS is unset (refresh is opt-in)" };
  }
  const intervalMs = Number(raw);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return {
      enabled: false,
      reason: `GRAPH_REFRESH_INTERVAL_MS='${raw}' is not a positive number`,
    };
  }
  return { enabled: true, intervalMs };
}

/** Minimal pino-compatible surface (avoids importing pino into the portal). */
export type ScheduleLogger = {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
};

type TimerHandle = { unref?: () => void };

/** Injectable timer seam (tests supply fakes; the plugin uses the Node globals). */
export type ScheduleTimers = {
  setTimeout(cb: () => void, ms: number): TimerHandle;
  setInterval(cb: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
  clearInterval(handle: TimerHandle): void;
};

const nodeTimers: ScheduleTimers = {
  setTimeout: (cb, ms) => setTimeout(cb, ms),
  setInterval: (cb, ms) => setInterval(cb, ms),
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout),
  clearInterval: (handle) => clearInterval(handle as NodeJS.Timeout),
};

export type ScheduleGraphRefreshDeps = {
  intervalMs: number;
  /** The pass to run — the live `refreshGraphSnapshots` in prod, a fake in tests. */
  refresh: () => Promise<unknown>;
  log: ScheduleLogger;
  /** Injectable serializer so a failing pass logs a structured error (defaults to
   *  a shallow `{ message }`; the plugin passes context-layer's `serializeError`). */
  serializeError?: (error: unknown) => unknown;
  timers?: ScheduleTimers;
  initialDelayMs?: number;
};

export type GraphRefreshHandle = {
  /** Stop the schedule (graceful shutdown / test cleanup). */
  stop: () => void;
};

/**
 * Run `refresh` once after a short boot delay, then every `intervalMs`. A failed
 * pass is logged and the next tick simply retries — it never rejects out of the
 * scheduler, so the server can never crash on a refresh error. Both timers are
 * `unref`'d so a pending pass never blocks process shutdown.
 */
export function scheduleGraphRefresh(deps: ScheduleGraphRefreshDeps): GraphRefreshHandle {
  const timers = deps.timers ?? nodeTimers;
  const serialize = deps.serializeError ?? defaultSerializeError;
  const initialDelayMs = Math.min(
    deps.initialDelayMs ?? INITIAL_GRAPH_REFRESH_DELAY_MS,
    deps.intervalMs,
  );

  const runPass = (): void => {
    // A pass never rejects out of here: derivation is best-effort on the lifecycle
    // plane, so a failure is a logged warning and the next tick retries.
    Promise.resolve()
      .then(deps.refresh)
      .then((result) => deps.log.info({ result }, "graph snapshot refresh pass complete"))
      .catch((error) =>
        deps.log.warn(
          { err: serialize(error) },
          "graph snapshot refresh pass failed; retrying next tick",
        ),
      );
  };

  const initial = timers.setTimeout(runPass, initialDelayMs);
  initial.unref?.();
  const interval = timers.setInterval(runPass, deps.intervalMs);
  interval.unref?.();

  return {
    stop: () => {
      timers.clearTimeout(initial);
      timers.clearInterval(interval);
    },
  };
}

function defaultSerializeError(error: unknown): unknown {
  return error instanceof Error ? { message: error.message } : error;
}
