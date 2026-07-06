/**
 * The scoped derived change-feed rendering (Step 2, M8 / P31), shared between the
 * `/changes` route and the Step-5 APP-home change-feed slice so there is ONE feed
 * path — the machine-derived feed, never the editorial What's New. Each row is
 * cited to the source root the delta was derived from and carries its freshness.
 */
import type { ChangeEvent, EventClass } from "@atlas/schema";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const CLASS_LABEL: Record<EventClass, string> = {
  "service-added": "Service added",
  "service-removed": "Service removed",
  "available-in-added": "Became available in",
  "available-in-removed": "Withdrawn from",
  "module-version-changed": "Module version changed",
  "governed-by-added": "Now governed by",
  "governed-by-removed": "No longer governed by",
};

const CLASS_TONE: Record<EventClass, string> = {
  "service-added": "text-emerald-600 dark:text-emerald-400",
  "service-removed": "text-rose-600 dark:text-rose-400",
  "available-in-added": "text-emerald-600 dark:text-emerald-400",
  "available-in-removed": "text-rose-600 dark:text-rose-400",
  "module-version-changed": "text-amber-600 dark:text-amber-400",
  "governed-by-added": "text-sky-600 dark:text-sky-400",
  "governed-by-removed": "text-rose-600 dark:text-rose-400",
};

/**
 * The feed body: a loading skeleton, an honest-empty state (never fabricated), or
 * the reverse-chronological list of cited change rows. Callers own their own
 * header + surrounding layout.
 */
export function ChangeFeedList({
  events,
  isLoading,
  emptyText,
}: {
  events: ReadonlyArray<ChangeEvent>;
  isLoading: boolean;
  emptyText: string;
}) {
  if (isLoading) {
    return (
      <ul className="flex flex-col gap-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <li key={i}>
            <Skeleton className="h-16 w-full rounded-lg" />
          </li>
        ))}
      </ul>
    );
  }
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {[...events].reverse().map((event) => (
        <ChangeRow key={event.id} event={event} />
      ))}
    </ul>
  );
}

export function ChangeRow({ event }: { event: ChangeEvent }) {
  const target = event.object ? `${event.subject.id} → ${event.object.id}` : event.subject.id;
  const versionDelta =
    event.from && event.to ? (
      <span className="text-muted-foreground">
        {" "}
        {event.from} → {event.to}
      </span>
    ) : null;

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-4">
        <span
          className={cn("text-xs font-semibold uppercase tracking-wide", CLASS_TONE[event.class])}
        >
          {CLASS_LABEL[event.class]}
        </span>
        <time className="text-xs text-muted-foreground" dateTime={event.derivedAt}>
          {formatDate(event.derivedAt)}
        </time>
      </div>
      <p className="mt-1 font-mono text-sm text-foreground">
        {target}
        {versionDelta}
      </p>
      {/* Provenance: every row cites the source root the delta was derived from. */}
      <p className="mt-1 text-xs text-muted-foreground">
        Derived from <span className="font-medium text-foreground">{event.rootId}</span>
        {event.landingZoneIds.length > 0 ? ` · ${event.landingZoneIds.join(", ")}` : ""}
      </p>
    </li>
  );
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
