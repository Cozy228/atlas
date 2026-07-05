/**
 * The per-root snapshot store (Step 2, M2/M10). Keyed `discovery:<envHash>:<rootId>`
 * in the EXISTING Valkey store (no new infra — snapshots share the content-cache
 * store); value = the root's `SnapshotPair` (K=2: confirmed baseline + pending
 * observation). This is derivation cache: loss ⇒ re-discover, no product data
 * lost (M2). The `resolvedAt` on each snapshot is a provenance clock, never a
 * second staleness clock (ADR-0013 §6 — one clock).
 *
 * The store is a thin port: read a pair, and compare-and-swap it atomically
 * (M10). The transition orchestration (`snapshotTransition.ts`) owns damping and
 * event derivation; the store owns only durable retention + atomicity, so the
 * CAS winner cannot be raced by a concurrent ECS task.
 */
import type { RootSnapshot, SnapshotPair } from "./graphTypes";

export interface SnapshotStore {
  /** Read the retained pair for one root (empty pair when the root is cold). */
  read(rootId: string): Promise<SnapshotPair>;
  /** Read every retained root's pair — the input to a full graph derivation. */
  readAll(): Promise<Map<string, SnapshotPair>>;
  /**
   * Atomically replace a root's pair (M10 compare-and-swap). Succeeds (returns
   * `true` — this writer won the transition) only when the store's CURRENT
   * pending identity equals `expectedPendingId` (`undefined` for a cold root).
   * A loser returns `false` and MUST discard its derived events, so concurrent
   * ECS tasks never emit conflicting baselines.
   */
  compareAndSwap(
    rootId: string,
    expectedPendingId: string | undefined,
    next: SnapshotPair,
  ): Promise<boolean>;
}

/** The identity a CAS compares on: a snapshot's content-stable pending key
 *  (its `resolvedAt` + contract version). `undefined` for a cold/absent root. */
export function pendingId(snapshot: RootSnapshot | undefined): string | undefined {
  if (!snapshot) {
    return undefined;
  }
  return `${snapshot.contractVersion}@${snapshot.resolvedAt}`;
}

/**
 * Process-local snapshot store for dev/tests (the Valkey adapter is
 * `valkeySnapshotStore.ts`, Batch 1). CAS is trivially atomic here (single
 * threaded JS), which is exactly what the D6 concurrent-transition test needs.
 */
export class InMemorySnapshotStore implements SnapshotStore {
  private readonly pairs = new Map<string, SnapshotPair>();

  async read(rootId: string): Promise<SnapshotPair> {
    return this.pairs.get(rootId) ?? {};
  }

  async readAll(): Promise<Map<string, SnapshotPair>> {
    return new Map(this.pairs);
  }

  async compareAndSwap(
    rootId: string,
    expectedPendingId: string | undefined,
    next: SnapshotPair,
  ): Promise<boolean> {
    // Single-threaded JS makes this read-compare-write atomic with respect to
    // other awaiters (no interleave between the read and the set), which is the
    // exact semantics the Valkey adapter reproduces with WATCH/MULTI.
    const current = this.pairs.get(rootId) ?? {};
    if (pendingId(current.pending) !== expectedPendingId) {
      return false;
    }
    this.pairs.set(rootId, next);
    return true;
  }
}
