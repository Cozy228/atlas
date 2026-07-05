/**
 * Snapshot transition (Step 2, M10) — the inline, in-process derivation that
 * runs at a snapshot transition (no free-running worker). On a fresh SUCCESSFUL
 * parse it: applies damping, CAS-swaps the per-root pair on the existing Valkey
 * store, and — iff it WON the swap and the delta was confirmed — derives events
 * (differ over two graph versions) and appends them idempotently. Losers discard
 * their derived events, so concurrent ECS tasks never emit conflicting baselines.
 *
 * On a FAILED parse it serves last-good, emits ZERO events, and returns one
 * aging note (decision 8) — the feed never lies during recovery.
 */
import type { ChangeEvent } from "@atlas/schema";
import type { AgingNote, RootSnapshot, SnapshotPair } from "./graphTypes";
import { pendingId, type SnapshotStore } from "./snapshotStore";
import type { EventsRepository } from "../repositories/eventsRepository";
import { decideDamping } from "../changes/damping";
import { diffGraphVersions } from "../changes/differ";
import { deriveGraph } from "./deriveGraph";
import { computeFreshness, SNAPSHOT_STALE_AFTER_MS } from "./freshness";

export type SnapshotTransitionDeps = {
  store: SnapshotStore;
  events: EventsRepository;
  now: () => Date;
};

export type SnapshotTransitionResult = {
  /** Whether this task won the CAS transition (M10). Losers append nothing. */
  won: boolean;
  /** Events newly appended by this transition (empty for flap/first-obs/loser). */
  events: ChangeEvent[];
};

export async function runSnapshotTransition(
  rootId: string,
  freshParse: RootSnapshot,
  deps: SnapshotTransitionDeps,
): Promise<SnapshotTransitionResult> {
  const pair = await deps.store.read(rootId);
  const outcome = decideDamping(pair, freshParse);

  // CAS on the pending pointer (M10). Only the winner advances the state and —
  // on a confirm — derives + appends events; a loser discards everything.
  const won = await deps.store.compareAndSwap(rootId, pendingId(pair.pending), outcome.next);
  if (!won || outcome.kind !== "confirm") {
    return { won, events: [] };
  }

  // The delta was confirmed and this task won: diff the graph BEFORE (this root
  // at its baseline) against AFTER (this root advanced), inline. Only this root
  // moved, so every derived event pertains to it (M10 inline derivation).
  const others = await otherConfirmedSnapshots(rootId, deps.store);
  const before = deriveGraph([...others, outcome.from]);
  const after = deriveGraph([...others, outcome.to]);
  const events = diffGraphVersions(before, after, {
    rootId,
    derivedAt: deps.now().toISOString(),
  });
  const appended = await deps.events.append(events);
  return { won: true, events: appended };
}

/** Every OTHER root's confirmed baseline — the stable context a single root's
 *  transition is diffed against. */
async function otherConfirmedSnapshots(
  rootId: string,
  store: SnapshotStore,
): Promise<RootSnapshot[]> {
  const all = await store.readAll();
  const snapshots: RootSnapshot[] = [];
  for (const [id, pair] of all) {
    if (id !== rootId && pair.confirmed) {
      snapshots.push(pair.confirmed);
    }
  }
  return snapshots;
}

export async function noteRootDegradation(
  rootId: string,
  deps: Pick<SnapshotTransitionDeps, "store" | "now">,
): Promise<AgingNote | null> {
  const lastGood = lastGoodSnapshot(await deps.store.read(rootId));
  if (!lastGood) {
    return null;
  }
  const { ageMs } = computeFreshness(lastGood.resolvedAt, deps.now());
  return {
    rootId,
    // The served clock is the last-good parse clock, NEVER now (decision 8).
    resolvedAt: lastGood.resolvedAt,
    message: `Root '${rootId}' failed to refresh; serving last-good from ${lastGood.resolvedAt} (aged ${Math.round(ageMs / 1000)}s).`,
  };
}

/** The parse to serve for a root: the last successful observation (`pending`),
 *  falling back to the confirmed baseline. */
function lastGoodSnapshot(pair: SnapshotPair): RootSnapshot | undefined {
  return pair.pending ?? pair.confirmed;
}

export type ServeRootSnapshotDeps = SnapshotTransitionDeps & {
  /** A root older than this reads as stale and triggers a refresh crawl. */
  staleAfterMs?: number;
};

export type ServeRootSnapshotResult = {
  /** The parse to serve this pass (fresh pending, or the just-crawled one). */
  snapshot: RootSnapshot;
  /** Whether the source system was actually hit (false = served from Valkey). */
  crawled: boolean;
  /** The transition outcome when a crawl happened (events derived inline). */
  transition?: SnapshotTransitionResult;
  /** Set when the refresh crawl FAILED and last-good is being served (decision 8). */
  aging?: AgingNote;
};

/**
 * The per-root serve entry the composition uses (Step 2, M2/M10). Cold start and
 * warm reads serve a fresh pending snapshot from Valkey with NO crawl; a
 * stale/cold root crawls via `crawl` and runs the transition inline (CAS + event
 * derivation). A crawl that THROWS serves last-good + an aging note, never an
 * empty subgraph. This is what collapses the multi-task cold-start crawl.
 */
export async function serveRootSnapshot(
  rootId: string,
  crawl: () => Promise<RootSnapshot>,
  deps: ServeRootSnapshotDeps,
): Promise<ServeRootSnapshotResult> {
  const staleAfterMs = deps.staleAfterMs ?? SNAPSHOT_STALE_AFTER_MS;
  const lastGood = lastGoodSnapshot(await deps.store.read(rootId));

  // Warm read: a fresh last-good snapshot is served straight from Valkey — no
  // crawl (cold-start / multi-task crawl collapse).
  if (lastGood && !computeFreshness(lastGood.resolvedAt, deps.now(), staleAfterMs).stale) {
    return { snapshot: lastGood, crawled: false };
  }

  // Cold or stale: refresh. A crawl that throws serves last-good + an aging note
  // (decision 8) — never an empty subgraph. With no last-good at all, the failure
  // is honest and propagates (nothing to serve).
  try {
    const fresh = await crawl();
    const transition = await runSnapshotTransition(rootId, fresh, deps);
    return { snapshot: fresh, crawled: true, transition };
  } catch (error) {
    const aging = await noteRootDegradation(rootId, deps);
    if (!lastGood || !aging) {
      throw error;
    }
    return { snapshot: lastGood, crawled: false, aging, transition: { won: false, events: [] } };
  }
}
