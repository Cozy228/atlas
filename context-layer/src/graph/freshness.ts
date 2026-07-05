/**
 * Read-time freshness (Step 2, decision 8 / ADR-0013 §6 — one clock). Staleness
 * is ALWAYS recomputed at read from the snapshot's `resolvedAt` vs now; the
 * snapshot is never a second clock. A root served last-good after a failed
 * refresh keeps its old `resolvedAt`, so it ages honestly and loudly — the
 * banner and the per-root freshness both fall out of this pure computation.
 */
import type { PerRootFreshness } from "@atlas/schema";
import type { RootSnapshot } from "./graphTypes";

/** Default staleness horizon: a root older than this reads as stale. */
export const SNAPSHOT_STALE_AFTER_MS = 60 * 60 * 1000;

export type Freshness = {
  resolvedAt: string;
  ageMs: number;
  stale: boolean;
};

export function computeFreshness(
  resolvedAt: string,
  now: Date,
  stalenessThresholdMs: number = SNAPSHOT_STALE_AFTER_MS,
): Freshness {
  const ageMs = Math.max(0, now.getTime() - new Date(resolvedAt).getTime());
  return { resolvedAt, ageMs, stale: ageMs > stalenessThresholdMs };
}

/** Per-root freshness for a set of snapshots, recomputed at read (never cached). */
export function perRootFreshness(
  snapshots: RootSnapshot[],
  now: Date,
  stalenessThresholdMs: number = SNAPSHOT_STALE_AFTER_MS,
): PerRootFreshness[] {
  return snapshots.map((snapshot) => {
    const { resolvedAt, stale } = computeFreshness(snapshot.resolvedAt, now, stalenessThresholdMs);
    return { rootId: snapshot.rootId, resolvedAt, stale };
  });
}
