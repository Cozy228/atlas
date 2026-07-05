/**
 * My changes · route `/changes`
 * ======================================================================
 * The machine-derived, per-scope change feed (Step 2, M8 / I6): `ChangeEvent`s
 * over the closed EventClass set, scoped by the shared APP / landing-zone
 * selector, each row cited to the source root it was derived from and carrying
 * its freshness. This is the seed of Step 5's APP-home change-feed slice.
 *
 * P31 (load-bearing): this is NOT What's New. What's New (`/whatsnew`) stays the
 * editorial Confluence newsletter, authored by humans; this surface is automatic,
 * derived, and scoped. The two are different surfaces and never merge.
 *
 * Data: the live derived feed (`fetchChanges`); in dev mock mode a deterministic
 * fictional feed renders the surface (a single discovery pass seeds baselines
 * silently, so the live feed is legitimately empty until changes accrue).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ChangeEvent, EventClass } from "@atlas/schema";

import { changesQueryOptionsFor } from "@/api/queries";
import { useSituation } from "@/components/landing-zone/context";
import { PageBody, PageHeader } from "@/components/page-section";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/changes")({
  loader: ({ context }) => {
    // Warm the unscoped feed without blocking navigation; the body reads the
    // scoped query (situation-dependent) and shows skeletons until it lands.
    void context.queryClient.ensureQueryData(changesQueryOptionsFor());
  },
  component: MyChangesRoute,
});

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

function MyChangesRoute() {
  const { selectedApp } = useSituation();
  const scope = selectedApp?.landingZoneIds;
  const { data, isLoading } = useQuery(changesQueryOptionsFor(scope));

  const events = data?.events ?? [];

  return (
    <>
      <PageHeader
        title="My changes"
        description={
          selectedApp
            ? `Derived changes scoped to ${selectedApp.name}.`
            : "Derived changes across the platform. Pick an app or landing zone to scope this feed."
        }
      />
      <PageBody>
        {isLoading ? (
          <ul className="flex flex-col gap-3" aria-hidden>
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-16 w-full rounded-lg" />
              </li>
            ))}
          </ul>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No changes in scope yet. As sources change, derived events land here — What&apos;s New
            stays the editorial newsletter.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {[...events].reverse().map((event) => (
              <ChangeRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </PageBody>
    </>
  );
}

function ChangeRow({ event }: { event: ChangeEvent }) {
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
