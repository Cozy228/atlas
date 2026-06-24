/**
 * What's New · route `/whatsnew`
 * ======================================================================
 * The platform changelog as a real broadsheet. A masthead, then a front with
 * genuine size hierarchy: a LEAD story, a SECONDARY two-column band, then —
 * because the snapshot day carries many updates — a boxed "Today" DISPATCH
 * roundup (dense, multi-column), and finally the older entries flowing as
 * EARLIER BRIEFS in newspaper columns under month run-ins. No per-day headers
 * for thin days; density varies like a paper. The rail carries the issue
 * furniture: an at-a-glance tally, an archive index, and an editor's note.
 *
 * Data: fictional, public-safe fixtures in `proto/whatsnew/data.ts`. Home's
 * "What changed" section links here; the freshest slice are Home's announcements.
 */
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  CHANGES,
  KIND_TONE,
  TONE_DOT,
  kindCounts,
  monthAnchor,
  type Change,
  type ChangeKind,
} from "@/components/whatsnew/data";
import { releaseNotesQueryOptions } from "@/api/queries";
import { ReleasesSection } from "@/components/whatsnew/releases";
import { cn } from "@/lib/utils";

const DATELINE = "Thursday · June 11, 2026";

export const Route = createFileRoute("/whatsnew")({
  loader: async ({ context }) => ({
    releases: await context.queryClient.ensureQueryData(releaseNotesQueryOptions),
  }),
  component: WhatsNewRoute,
});

function WhatsNewRoute() {
  const { releases } = Route.useLoaderData();
  const lead = CHANGES[0];
  const secondary = CHANGES.slice(1, 3);
  const rest = CHANGES.slice(3);
  // The snapshot day's remaining updates cluster into a "Today" roundup; the
  // older entries flow as briefs. This is what gives a heavy day real weight.
  const today = lead ? rest.filter((c) => c.date === lead.date) : [];
  const earlier = lead ? rest.filter((c) => c.date !== lead.date) : rest;
  const earlierMonths = groupByMonth(earlier);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-8 px-6 py-8 sm:px-8">
      <Masthead />
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_240px]">
        <main className="flex min-w-0 flex-col">
          {lead ? <LeadStory change={lead} /> : null}

          {secondary.length > 0 ? (
            <div className="mt-8 grid gap-x-10 gap-y-6 border-t-2 border-border-strong pt-6 sm:grid-cols-2">
              {secondary.map((change, i) => (
                <SecondaryStory key={change.id} change={change} divided={i > 0} />
              ))}
            </div>
          ) : null}

          {today.length > 0 ? <TodayDispatch items={today} /> : null}

          <ReleasesSection releases={releases} />

          {earlierMonths.map(({ month, items }) => (
            <section key={month} id={monthAnchor(month)} className="mt-8 scroll-mt-20">
              <h2 className="mb-4 flex items-baseline gap-3 border-t border-border pt-3">
                <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {month}
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                  {items.length} {items.length === 1 ? "entry" : "entries"}
                </span>
              </h2>
              {/* Newspaper columns: briefs flow top-to-bottom, each carries its date */}
              <ul className="gap-x-10 sm:columns-2 lg:columns-3">
                {items.map((change) => (
                  <BriefRow key={change.id} change={change} columned />
                ))}
              </ul>
            </section>
          ))}
        </main>
        <Rail />
      </div>
    </div>
  );
}

function Masthead() {
  return (
    <header className="flex flex-col gap-4 border-b-[3px] border-double border-border-strong pb-5">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="tabular-nums">{DATELINE}</span>
        <span className="hidden tracking-[0.2em] sm:inline">The Atlas Dispatch</span>
        <span>Internal</span>
      </div>
      {/* Same column grid as the body below, so the edition plate's divider lines
          up exactly with the rail's hairline. */}
      <div className="grid items-end gap-x-12 gap-y-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="flex flex-col gap-1.5">
          <h1 className="w-fit bg-background text-[3rem] font-bold leading-[0.95] tracking-[-0.045em] text-foreground sm:text-[3.5rem]">
            What&rsquo;s New
          </h1>
          <p className="w-fit max-w-[52ch] bg-background text-[13px] italic leading-[1.5] text-muted-foreground">
            Platform releases, policy changes, and resolved incidents across the cloud platform —
            newest first.
          </p>
        </div>
        {/* Masthead furniture — edition plate, not a stat (the rail tallies). */}
        <dl className="flex flex-col gap-1.5 text-right font-mono text-[12px] uppercase tracking-[0.1em] text-muted-foreground lg:border-l lg:border-border lg:pl-7">
          <EditionRow label="Edition" value="Vol. IV · No. 23" />
          <EditionRow label="Desk" value="Platform Comms" />
          <EditionRow label="Circulation" value="Internal" />
        </dl>
      </div>
    </header>
  );
}

function EditionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-end gap-3">
      <dt className="text-muted-foreground/60">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function Kicker({ change, size = "sm" }: { change: Change; size?: "sm" | "lg" }) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn("rounded-full", size === "lg" ? "size-2" : "size-1.5", TONE_DOT[change.tone])}
      />
      <span
        className={cn(
          "bg-background font-mono font-semibold uppercase tracking-[0.06em] text-muted-foreground",
          size === "lg" ? "text-[11px]" : "text-[10px]",
        )}
      >
        {change.kind} · {change.date}
      </span>
    </span>
  );
}

function StoryLink({ change }: { change: Change }) {
  if (!change.link) return null;
  return (
    <Link
      to={change.link.to}
      className="flex w-fit items-center gap-1 bg-background text-[12.5px] font-semibold text-brand-ink hover:underline"
    >
      {change.link.label}
      <span aria-hidden>→</span>
    </Link>
  );
}

function LeadStory({ change }: { change: Change }) {
  return (
    <article className="flex flex-col gap-3">
      <Kicker change={change} size="lg" />
      <h2 className="w-fit max-w-[20ch] bg-background text-[2.25rem] font-bold leading-[1.05] tracking-[-0.03em] text-balance text-foreground">
        {change.title}
      </h2>
      <p className="w-fit max-w-[62ch] bg-background text-[15px] leading-[1.6] text-pretty text-muted-foreground">
        {change.summary}
      </p>
      <StoryLink change={change} />
    </article>
  );
}

function SecondaryStory({ change, divided }: { change: Change; divided: boolean }) {
  return (
    <article className={cn("flex flex-col gap-2", divided && "border-border sm:border-l sm:pl-10")}>
      <Kicker change={change} />
      <h3 className="w-fit bg-background text-[1.25rem] font-bold leading-[1.2] tracking-[-0.02em] text-foreground">
        {change.title}
      </h3>
      <p className="w-fit max-w-[52ch] bg-background text-[13px] leading-[1.55] text-muted-foreground">
        {change.summary}
      </p>
      <StoryLink change={change} />
    </article>
  );
}

/**
 * Today's roundup — the snapshot day's remaining updates as a boxed dispatch:
 * a heavy news day handled the way a paper would, not a list of one-item days.
 */
function TodayDispatch({ items }: { items: ReadonlyArray<Change> }) {
  return (
    <ul className="mt-7 gap-x-9 border-t-2 border-border-strong pt-5 sm:columns-2 lg:columns-3">
      {items.map((change) => (
        <BriefRow key={change.id} change={change} columned dense />
      ))}
    </ul>
  );
}

function BriefRow({
  change,
  columned = false,
  dense = false,
}: {
  change: Change;
  columned?: boolean;
  dense?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-1 border-t border-border py-3",
        columned ? "mb-4 break-inside-avoid" : "first:border-t-0 sm:first:border-t",
        dense && "py-2",
      )}
    >
      <Kicker change={change} />
      <h3 className="w-fit bg-background text-[13.5px] font-bold tracking-[-0.01em] text-foreground">
        {change.title}
      </h3>
      <p
        className={cn(
          "w-fit max-w-[44ch] bg-background text-[12px] leading-[1.5] text-muted-foreground",
          dense && "line-clamp-2",
        )}
      >
        {change.summary}
      </p>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rail                                                                      */
/* -------------------------------------------------------------------------- */

function Rail() {
  const kinds = kindCounts();
  const months = groupByMonth(CHANGES);
  return (
    <aside className="flex min-w-0 flex-col gap-8 lg:border-l lg:border-border lg:pl-7">
      <RailModule label="At a glance">
        <dl className="grid grid-cols-2 gap-y-3 gap-x-4">
          <GlanceStat value={CHANGES.length} label="updates" />
          {kinds.slice(0, 3).map((k) => (
            <GlanceStat key={k.kind} value={k.count} label={k.kind.toLowerCase()} tone={k.kind} />
          ))}
        </dl>
      </RailModule>

      <RailModule label="By type">
        <dl className="flex flex-col gap-2">
          {kinds.map((k) => (
            <div key={k.kind} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", TONE_DOT[KIND_TONE[k.kind]])}
                />
                <span className="bg-background text-[12.5px] text-foreground">{k.kind}</span>
              </dt>
              <dd className="bg-background font-mono text-[11px] tabular-nums text-muted-foreground">
                {k.count}
              </dd>
            </div>
          ))}
        </dl>
      </RailModule>

      <RailModule label="Archive">
        <ul className="flex flex-col">
          {months.map((m, i) => (
            <li key={m.month} className={cn(i > 0 && "border-t border-border")}>
              <a
                href={`#${monthAnchor(m.month)}`}
                className="group flex items-baseline justify-between gap-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="bg-background text-[13px] font-semibold text-foreground group-hover:text-brand-ink">
                  {m.month}
                </span>
                <span className="shrink-0 bg-background font-mono text-[11px] tabular-nums text-muted-foreground">
                  {m.items.length}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </RailModule>

      <RailModule label="Editor's note">
        <p className="bg-background text-[12px] leading-[1.6] text-muted-foreground">
          Every entry links back to the surface that owns it — a catalog page, a guidance route, or
          a source record. Read the dispatch top-down for the day&rsquo;s shape, or jump by type.
        </p>
      </RailModule>
    </aside>
  );
}

function GlanceStat({ value, label, tone }: { value: number; label: string; tone?: ChangeKind }) {
  return (
    <div className="flex flex-col">
      <dd
        className={cn(
          "text-[1.5rem] font-bold leading-none tabular-nums tracking-[-0.02em] text-foreground",
          tone === "Policy" && "text-warning",
          tone === "Deprecated" && "text-critical",
        )}
      >
        {value}
      </dd>
      <dt className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
    </div>
  );
}

function RailModule({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="w-fit border-b-2 border-border-strong bg-background pb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </h2>
      {children}
    </section>
  );
}

function groupByMonth(
  items: ReadonlyArray<Change>,
): ReadonlyArray<{ month: string; items: Change[] }> {
  const order: string[] = [];
  const byMonth = new Map<string, Change[]>();
  for (const change of items) {
    if (!byMonth.has(change.month)) {
      byMonth.set(change.month, []);
      order.push(change.month);
    }
    byMonth.get(change.month)!.push(change);
  }
  return order.map((month) => ({ month, items: byMonth.get(month)! }));
}
