/**
 * Stability damping (Step 2, M6) — the pure decision that turns a fresh parse
 * into "emit / hold / nothing", using ONLY the K=2 pair (confirmed baseline +
 * pending observation). A delta becomes Evidence only once it has persisted
 * across two consecutive successful parses:
 *
 *   - no confirmed yet (cold root)      → seed the baseline SILENTLY (we don't
 *                                         know history before we started watching)
 *   - fresh == confirmed                → noop: refresh `pending`, no delta
 *   - fresh == pending, pending != conf → confirm: the delta survived a second
 *                                         parse → derive events, advance baseline
 *   - fresh != confirmed, first sighting → hold: stash as `pending`, emit nothing
 *
 * A single-parse flap (delta appears, next parse reverts) therefore emits zero
 * events; a degradation gap is handled upstream (a FAILED parse is never fed
 * here — the transition layer serves last-good + an aging note).
 */
import type { RootSnapshot, SnapshotPair } from "../graph/graphTypes";
import { contentHash } from "../graph/contentHash";

export type DampingOutcome =
  | { kind: "seed"; next: SnapshotPair }
  | { kind: "noop"; next: SnapshotPair }
  | { kind: "hold"; next: SnapshotPair }
  | { kind: "confirm"; from: RootSnapshot; to: RootSnapshot; next: SnapshotPair };

export function decideDamping(pair: SnapshotPair, fresh: RootSnapshot): DampingOutcome {
  const { confirmed, pending } = pair;

  // Cold root: no baseline yet — seed it silently (we don't know history before
  // we started watching, so the first parse is never a storm of `-added`s).
  if (!confirmed) {
    return { kind: "seed", next: { confirmed: fresh, pending: fresh } };
  }

  // No delta vs the baseline: just refresh `pending` (advances resolvedAt only).
  // This also RESOLVES a flap — a prior `pending` candidate that differed is
  // dropped when the facts return to the baseline.
  if (parseEquals(fresh, confirmed)) {
    return { kind: "noop", next: { confirmed, pending: fresh } };
  }

  // The delta persisted across two consecutive parses (the held `pending` and
  // this fresh parse agree, and both differ from the baseline): CONFIRM. The
  // differ diffs baseline→fresh; the baseline advances to fresh.
  if (pending && parseEquals(fresh, pending)) {
    return {
      kind: "confirm",
      from: confirmed,
      to: fresh,
      next: { confirmed: fresh, pending: fresh },
    };
  }

  // First sighting of this delta (or a brand-new different delta): hold it as the
  // candidate and emit nothing until it survives a second parse.
  return { kind: "hold", next: { confirmed, pending: fresh } };
}

/** Two snapshots are "the same parse" when their descriptive facts match —
 *  `resolvedAt` / `contractVersion` are provenance, not content, so they are
 *  excluded (a re-fetch that changes nothing is not a delta). */
export function parseEquals(a: RootSnapshot, b: RootSnapshot): boolean {
  return contentHash(a.parse) === contentHash(b.parse);
}
