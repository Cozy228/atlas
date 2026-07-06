/**
 * Stale-subgraph banner (Step-2 tail, decision 8 / D10) — the LOUD, honest aging
 * surface for the change feed. Rendered wherever the feed renders (the `/changes`
 * route and the Step-5 APP-home feed slice). It appears only when a source root
 * is stale or carries an aging note, names the affected root(s), and shows each
 * one's age computed CLIENT-SIDE from `resolvedAt` at render (one clock — never a
 * stored age). It never blocks the feed: the live roots' rows keep rendering
 * below it, so one aging subgraph does not blank the others.
 */
import type { ChangeFeedRoot } from "@atlas/schema";

/** Compact human age from an ISO `resolvedAt`, recomputed at render (one clock). */
function humanAge(resolvedAt: string, now: number): string {
  const ms = Math.max(0, now - Date.parse(resolvedAt));
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) {
    return `${hours}h`;
  }
  return `${Math.round(hours / 24)}d`;
}

export function StaleSubgraphBanner({ roots }: { roots: ReadonlyArray<ChangeFeedRoot> }) {
  const aging = roots.filter((root) => root.stale || root.agingNote);
  if (aging.length === 0) {
    return null;
  }
  const now = Date.now();

  return (
    <div
      role="alert"
      data-testid="stale-subgraph-banner"
      className="mb-6 rounded-lg border-2 border-amber-500/70 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-100"
    >
      <p className="text-sm font-semibold">
        {aging.length === 1
          ? "1 source root is aging — its part of the graph may be out of date."
          : `${aging.length} source roots are aging — their parts of the graph may be out of date.`}
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {aging.map((root) => (
          <li key={root.rootId} className="text-sm">
            <span className="font-mono font-medium">{root.rootId}</span>{" "}
            <span className="text-amber-800 dark:text-amber-300">
              — last resolved {humanAge(root.resolvedAt, now)} ago
            </span>
            {root.agingNote ? (
              <span className="mt-0.5 block text-xs text-amber-800 dark:text-amber-300/90">
                {root.agingNote}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-800 dark:text-amber-300/90">
        The other roots are live; this feed keeps showing their changes below.
      </p>
    </div>
  );
}
