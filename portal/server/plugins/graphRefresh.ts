/**
 * Lifecycle-plane graph snapshot refresh (Step 2, M2/M10) — the production caller
 * for `refreshGraphSnapshots`, closing the flagged "NO production caller" gap.
 *
 * A Nitro server plugin (auto-scanned from `server/plugins/`, so it runs in both
 * the dev and prod builds). On server start it decides via `resolveGraphRefreshGate`
 * whether to schedule the periodic refresh, and if so kicks one pass shortly after
 * boot and then every `GRAPH_REFRESH_INTERVAL_MS`. All schedule/gate logic lives in
 * `../lifecycle/graphRefreshSchedule` (unit tested without Nitro or the network);
 * this file only wires `process.env`, the live pass, and the pino logger.
 *
 * A plain default-export function (NOT `defineNitroPlugin` — that auto-import is
 * untyped under portal's tsconfig; the dev MSW plugin follows the same precedent).
 * Nitro calls it once at startup. The schedule NEVER runs under vitest (Nitro is
 * not mounted there, and the gate refuses `NODE_ENV=test`/`VITEST` regardless).
 */
import { refreshGraphSnapshots, logger, serializeError } from "@atlas/context-layer";

import { resolveGraphRefreshGate, scheduleGraphRefresh } from "../lifecycle/graphRefreshSchedule";

const log = logger("graph");

export default () => {
  const gate = resolveGraphRefreshGate(process.env);
  if (!gate.enabled) {
    log.info({ reason: gate.reason }, "graph snapshot refresh not scheduled");
    return;
  }

  scheduleGraphRefresh({
    intervalMs: gate.intervalMs,
    refresh: () => refreshGraphSnapshots(),
    log,
    serializeError,
  });
  log.info({ intervalMs: gate.intervalMs }, "graph snapshot refresh scheduled");
};
