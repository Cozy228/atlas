import type { Source } from "@atlas/schema";

/**
 * True when a Source is past its review frequency relative to `now` — i.e. the
 * recorded baseline has drifted and a `stale_source` warning is due.
 *
 * Staleness is the *staleness clock* (ADR-0013 §6): it is recomputed on every
 * projection from the registry's current `review_frequency` / `last_reviewed_at`
 * versus `now`, and is deliberately NOT frozen into any perf cache. The Context
 * bundle path and the resource-projection path share this one function so the
 * two surfaces can never disagree about whether a Source is stale.
 */
export function isStale(source: Source, now: Date): boolean {
  const days = Number(source.review_frequency.match(/^P(\d+)D$/)?.[1] ?? "0");
  if (days === 0) {
    return false;
  }
  const reviewedAt = new Date(source.last_reviewed_at).getTime();
  return reviewedAt + days * 24 * 60 * 60 * 1000 < now.getTime();
}
