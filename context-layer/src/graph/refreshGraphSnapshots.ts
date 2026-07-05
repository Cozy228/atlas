/**
 * The discovery snapshot pass (Step 2, M2/M10) — the lifecycle-plane entry that
 * refreshes every source root's snapshot and derives change events inline at each
 * transition. Runs per-root through {@link serveRootSnapshot}: a fresh snapshot is
 * served without crawling; a stale/cold root crawls + transitions; a failed root
 * ages honestly (one aging note, zero phantom events).
 *
 * This is DERIVATION on the lifecycle plane (mid-level §4: a scheduled refresh
 * task, Optional at runtime), NOT the request hot path — so it never adds latency
 * to a resource/brief read and `createDefaultContextService` is unchanged. A
 * scheduler (or an explicit admin trigger) calls it; the first pass seeds each
 * root's baseline SILENTLY (no storm), and subsequent passes emit only confirmed,
 * damped deltas.
 *
 * ⚠️ SCOPED GAP (flagged for the reviewer): NO production caller exists yet — no
 * scheduler, admin route, or Nitro plugin invokes this pass, and composition.ts
 * still serves discovery from its in-process memo. Until the lifecycle trigger
 * and the composition rewire land, the live `/api/changes` feed stays empty
 * (dev renders via `changesMock`); the spine below is proven as library
 * behavior by `changeFeed.feature.test.ts`, not as wired system behavior.
 */
import { createResolutionContext } from "../resolvers/createResolutionContext";
import { createConfluenceAvailabilityProvider } from "../sourceContent/confluenceAvailabilityProvider";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import { logger, serializeError } from "../observability/logging";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";
import type { AgingNote } from "./graphTypes";
import { sharedSnapshotStore } from "./snapshotStoreFactory";
import { buildRootDescriptors } from "./rootConfig";
import { serveRootSnapshot, type ServeRootSnapshotDeps } from "./snapshotTransition";

const log = logger("graph");

export type RefreshGraphSnapshotsOptions = {
  env?: Record<string, string | undefined>;
  /** Injectable spine (tests); defaults to the live Confluence availability provider. */
  availabilityProvider?: AvailabilityProvider;
  now?: () => Date;
};

export type RefreshGraphSnapshotsResult = {
  /** Total change events derived across every root this pass. */
  events: number;
  /** Aging notes for roots served last-good after a failed refresh (decision 8). */
  aging: AgingNote[];
};

export async function refreshGraphSnapshots(
  options: RefreshGraphSnapshotsOptions = {},
): Promise<RefreshGraphSnapshotsResult> {
  const env = options.env ?? readProcessEnv();
  const ctx = await createResolutionContext({ env });
  const availabilityProvider =
    options.availabilityProvider ?? createConfluenceAvailabilityProvider({ fetch: ctx.fetch, env });

  const deps: ServeRootSnapshotDeps = {
    store: sharedSnapshotStore(env),
    events: sharedEventsRepository(env),
    now: options.now ?? (() => new Date()),
  };

  // One thunk per root; a root's own failure is isolated (one subgraph ages, the
  // others stay live — acceptance B). The refresh stamps `resolvedAt` with its
  // injectable clock (`deps.now`) around the shared descriptor's parse.
  const roots = buildRootDescriptors({ ctx, availabilityProvider, env }).map((root) => ({
    id: root.rootId,
    crawl: (): Promise<import("./graphTypes").RootSnapshot> =>
      root.parse().then((parse) => ({
        rootId: root.rootId,
        parse,
        resolvedAt: deps.now().toISOString(),
        contractVersion: root.contractVersion,
      })),
  }));

  let events = 0;
  const aging: AgingNote[] = [];
  for (const root of roots) {
    try {
      const result = await serveRootSnapshot(root.id, root.crawl, deps);
      events += result.transition?.events.length ?? 0;
      if (result.aging) aging.push(result.aging);
    } catch (error) {
      // A cold root with no last-good and a failing crawl: honest dead subgraph,
      // logged and skipped — the other roots still refresh.
      log.warn(
        { rootId: root.id, err: serializeError(error) },
        `snapshot refresh failed: ${root.id}`,
      );
    }
  }

  log.info(
    { events, agingRoots: aging.map((a) => a.rootId) },
    `graph snapshot refresh: ${events} event(s)`,
  );
  return { events, aging };
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
