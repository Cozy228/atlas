/**
 * PROTOTYPE (production candidate) — What's New · route `/proto/whatsnew`
 * ======================================================================
 * The platform changelog as a real broadsheet: a masthead, then a front with
 * genuine size hierarchy — one LEAD story (big), a band of SECONDARY stories
 * (medium, columned), and the rest as compact BRIEFS grouped by month. The rail
 * carries the issue furniture: a per-type tally and a month index. Newest first.
 *
 * Data: fictional, public-safe fixtures in `proto/whatsnew/data.ts`. Home's
 * "What changed" section links here.
 */
import { Link, createFileRoute } from "@tanstack/react-router";

import {
  CHANGES,
  KIND_TONE,
  TONE_DOT,
  kindCounts,
  monthAnchor,
  type Change,
} from "@/components/proto/whatsnew/data";
import { cn } from "@/lib/utils";

const DATELINE = "Thursday · June 11, 2026";

export const Route = createFileRoute("/proto/whatsnew")({
  component: ProtoWhatsNew,
});

function ProtoWhatsNew() {
  const lead = CHANGES[0];
  const secondary = CHANGES.slice(1, 3);
  const briefMonths = groupByMonth(CHANGES.slice(3));

  return (
    <div className="mx-auto flex w-full max-w-[1160px] flex-col gap-8 px-6 py-8 sm:px-8">
      <Masthead />
      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_232px]">
        <main className="flex min-w-0 flex-col">
          {lead ? <LeadStory change={lead} /> : null}

          {secondary.length > 0 ? (
            <div className="mt-8 grid gap-x-10 gap-y-6 border-t-2 border-border-strong pt-6 sm:grid-cols-2">
              {secondary.map((change, i) => (
                <SecondaryStory key={change.id} change={change} divided={i > 0} />
              ))}
            </div>
          ) : null}

          {briefMonths.map(({ month, items }) => (
            <section key={month} id={monthAnchor(month)} className="mt-8 scroll-mt-20">
              <h2 className="mb-3 border-t border-border pt-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {month}
              </h2>
              <ul className="grid gap-x-10 sm:grid-cols-2">
                {items.map((change) => (
                  <BriefRow key={change.id} change={change} />
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
    <header className="flex flex-col gap-3 border-b-2 border-border-strong pb-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="bg-background font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums text-muted-foreground">
          {DATELINE}
        </span>
        <span className="bg-background font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
          Demo dispatch · fictional entries
        </span>
      </div>
      <h1 className="w-fit bg-background text-[2.75rem] font-bold leading-[1.0] tracking-[-0.04em] text-foreground">
        What&rsquo;s New
      </h1>
      <p className="w-fit max-w-[60ch] bg-background text-[13.5px] leading-[1.55] text-muted-foreground">
        Platform releases, policy changes, and resolved incidents across the cloud platform —
        newest first.
      </p>
    </header>
  );
}

function Kicker({ change, size = "sm" }: { change: Change; size?: "sm" | "lg" }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className={cn("rounded-full", size === "lg" ? "size-2" : "size-1.5", TONE_DOT[change.tone])} />
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

function BriefRow({ change }: { change: Change }) {
  return (
    <li className="flex flex-col gap-1 border-t border-border py-3.5 first:border-t-0 sm:first:border-t">
      <Kicker change={change} />
      <h3 className="w-fit bg-background text-[13.5px] font-bold tracking-[-0.01em] text-foreground">
        {change.title}
      </h3>
      <p className="w-fit max-w-[48ch] bg-background text-[12px] leading-[1.5] text-muted-foreground">
        {change.summary}
      </p>
    </li>
  );
}

function Rail() {
  const kinds = kindCounts();
  const months = groupByMonth(CHANGES);
  return (
    <aside className="flex min-w-0 flex-col gap-8 lg:border-l lg:border-border lg:pl-7">
      <RailModule label="In this issue">
        <dl className="flex flex-col gap-2">
          {kinds.map((k) => (
            <div key={k.kind} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2">
                <span aria-hidden className={cn("size-2 rounded-full", TONE_DOT[KIND_TONE[k.kind]])} />
                <span className="bg-background text-[12.5px] text-foreground">{k.kind}</span>
              </dt>
              <dd className="bg-background font-mono text-[11px] tabular-nums text-muted-foreground">
                {k.count}
              </dd>
            </div>
          ))}
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-border pt-2">
            <dt className="bg-background text-[12.5px] font-semibold text-foreground">Total</dt>
            <dd className="bg-background font-mono text-[11px] font-semibold tabular-nums text-foreground">
              {CHANGES.length}
            </dd>
          </div>
        </dl>
      </RailModule>

      <RailModule label="Months">
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
    </aside>
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

function groupByMonth(items: ReadonlyArray<Change>): ReadonlyArray<{ month: string; items: Change[] }> {
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
