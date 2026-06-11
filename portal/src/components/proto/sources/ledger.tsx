/**
 * PROTOTYPE (production candidate) — Sources direction "Registry ledger".
 *
 * Sources are Atlas's evidence backbone, so they get a full ledger: a HEALTH
 * BAND (authority composition, freshness, stewardship — computed from real
 * data), then the Document Sources NUMBERED PANEL sortable by authority or
 * freshness. Stale entries carry a calm warning, never alarm styling.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight, IconLock } from "@tabler/icons-react";
import type { Source } from "@atlas/schema";

import { AuthorityBadge, FreshnessIndicator } from "@/components/evidence/badges";
import { AUTHORITY_ORDER, compareByAuthority, type FreshnessState } from "@/lib/evidence";
import { cn } from "@/lib/utils";

import { AUTHORITY_BAR, CLASS_LABEL, FRESHNESS_META, freshnessMap, reviewedLabel } from "./shared";

type SortMode = "authority" | "freshness";

export function SourcesLedger({ sources }: { sources: ReadonlyArray<Source> }) {
  const [sort, setSort] = useState<SortMode>("authority");
  const freshnessOf = useMemo(() => freshnessMap(sources), [sources]);

  const sorted = useMemo(() => {
    if (sort === "authority") return sources.toSorted(compareByAuthority);
    const rank: Record<FreshnessState, number> = { stale: 0, "needs-review": 1, current: 2 };
    return sources.toSorted(
      (a, b) =>
        rank[freshnessOf.get(a.id) ?? "needs-review"] - rank[freshnessOf.get(b.id) ?? "needs-review"],
    );
  }, [sources, sort, freshnessOf]);

  const byAuthority = AUTHORITY_ORDER.map((level) => ({
    level,
    count: sources.filter((source) => source.authority_level === level).length,
  })).filter((entry) => entry.count > 0);

  const byFreshness = (Object.keys(FRESHNESS_META) as FreshnessState[]).map((state) => ({
    state,
    count: sources.filter((source) => freshnessOf.get(source.id) === state).length,
  }));

  const stewards = new Set(sources.map((source) => source.steward)).size;
  const restricted = sources.filter((source) => source.visibility === "restricted").length;

  return (
    <div className="flex flex-col gap-7">
      <Header sources={sources} />

      <section className="grid gap-3 sm:grid-cols-3">
        <HealthPanel title="Authority">
          <div className="flex h-2 overflow-hidden rounded-[2px]">
            {byAuthority.map((entry) => (
              <span key={entry.level} aria-hidden className={AUTHORITY_BAR[entry.level]} style={{ flex: `${entry.count} 1 0` }} />
            ))}
          </div>
          <ul className="flex flex-col gap-1">
            {byAuthority.map((entry) => (
              <li key={entry.level} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="flex items-center gap-1.5 capitalize text-muted-foreground">
                  <span aria-hidden className={cn("size-2 rounded-[1px]", AUTHORITY_BAR[entry.level])} />
                  {entry.level}
                </span>
                <span className="font-semibold tabular-nums text-foreground">{entry.count}</span>
              </li>
            ))}
          </ul>
        </HealthPanel>

        <HealthPanel title="Freshness">
          <ul className="flex flex-col gap-2">
            {byFreshness.map((entry) => (
              <li key={entry.state} className="flex items-baseline justify-between gap-3 text-[12px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span aria-hidden className={cn("size-2 rounded-full", FRESHNESS_META[entry.state].dot)} />
                  {FRESHNESS_META[entry.state].label}
                </span>
                <span className="font-semibold tabular-nums text-foreground">{entry.count}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11.5px] leading-[1.5] text-muted-foreground">
            Stale means past the registered review window. The owner sees it too.
          </p>
        </HealthPanel>

        <HealthPanel title="Stewardship">
          <dl className="flex flex-col gap-2">
            <Row label="Stewarding teams" value={stewards} />
            <Row label="Restricted visibility" value={restricted} />
            <Row label="Source classes" value={new Set(sources.map((s) => s.source_class)).size} />
          </dl>
        </HealthPanel>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="w-fit bg-background text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
            Registered documents
          </h2>
          <div className="flex rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Sort">
            <SortButton active={sort === "authority"} onClick={() => setSort("authority")}>By authority</SortButton>
            <SortButton active={sort === "freshness"} onClick={() => setSort("freshness")}>By freshness</SortButton>
          </div>
        </div>

        <div className="overflow-hidden rounded-[4px] border border-border bg-card">
          {sorted.map((source, i) => (
            <LedgerEntry key={source.id} source={source} index={i + 1} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function Header({ sources }: { sources: ReadonlyArray<Source> }) {
  return (
    <header className="flex flex-col gap-1.5">
      <h1 className="w-fit bg-background text-2xl font-bold tracking-[-0.02em] text-foreground">
        Source registry
      </h1>
      <p className="w-fit max-w-[66ch] bg-background text-[13.5px] leading-[1.55] text-muted-foreground">
        Every claim in Atlas resolves to one of these {sources.length} registered documents.
        Authority and freshness are computed live from the registry, not asserted.
      </p>
    </header>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12px]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function HealthPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[4px] border border-border bg-card p-4">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {title}
      </span>
      {children}
    </div>
  );
}

function SortButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "rounded-[5px] px-2.5 py-1 text-xs font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function LedgerEntry({ source, index }: { source: Source; index: number }) {
  return (
    <Link
      to="/sources/$sourceId"
      params={{ sourceId: source.id }}
      className={cn(
        "group grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 gap-y-2 px-4 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_200px]",
        index > 1 && "border-t border-border",
        "transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
    >
      <span aria-hidden className="pt-0.5 text-right text-[1.25rem] font-bold leading-none tabular-nums text-muted-foreground/50">
        {index}
      </span>

      <span className="flex min-w-0 flex-col gap-1 pl-2">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-[14px] font-bold tracking-[-0.01em] text-foreground group-hover:text-brand-ink">
            {source.title}
          </span>
          {source.visibility === "restricted" ? (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              <IconLock aria-hidden className="size-3" />
              restricted
            </span>
          ) : null}
        </span>
        <code className="font-mono text-[10.5px] text-muted-foreground">
          {CLASS_LABEL[source.source_class]} · {source.id}
        </code>
        <span className="text-[12.5px] leading-[1.5] text-muted-foreground">
          Authority over{" "}
          {source.authority_scope.map((scope, i) => (
            <span key={scope}>
              {i > 0 ? ", " : ""}
              <code className="font-mono text-[11px]">{scope}</code>
            </span>
          ))}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-2">
          <AuthorityBadge level={source.authority_level} />
          <FreshnessIndicator source={source} />
        </span>
      </span>

      <span className="col-start-2 flex flex-col gap-1 pl-2 text-[11.5px] text-muted-foreground sm:col-start-3 sm:items-end sm:pl-0 sm:text-right">
        <span className="font-medium text-foreground">{source.steward}</span>
        <span className="tabular-nums">reviewed {reviewedLabel(source)}</span>
        <span className="tabular-nums">every {source.review_frequency.replace(/^P/, "").toLowerCase()}</span>
        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[12px] font-semibold text-muted-foreground transition-colors group-hover:text-brand-ink">
          Open record
          <IconArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}
