/**
 * PROTOTYPE (production candidate) — Sources direction "Stewardship board".
 *
 * A maintenance triage register: sources grouped by freshness state, the ones
 * needing action surfaced first (Stale → Review due → Current). Answers the
 * steward's question — "what do I need to re-review?" — calmly, never alarmed.
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";
import type { Source } from "@atlas/schema";

import { AuthorityBadge } from "@/components/evidence/badges";
import type { FreshnessState } from "@/lib/evidence";
import { cn } from "@/lib/utils";

import { Header } from "./ledger";
import { CLASS_LABEL, FRESHNESS_META, freshnessMap, reviewedLabel } from "./shared";

const STATE_ORDER: ReadonlyArray<FreshnessState> = ["stale", "needs-review", "current"];

const STATE_BLURB: Record<FreshnessState, string> = {
  stale: "Past the review window — re-confirm or retire.",
  "needs-review": "Review window closing soon.",
  current: "Within the registered review window.",
};

export function SourcesBoard({ sources }: { sources: ReadonlyArray<Source> }) {
  const freshnessOf = useMemo(() => freshnessMap(sources), [sources]);

  const groups = STATE_ORDER.map((state) => ({
    state,
    items: sources
      .filter((s) => freshnessOf.get(s.id) === state)
      .toSorted((a, b) => +new Date(a.last_reviewed_at) - +new Date(b.last_reviewed_at)),
  })).filter((g) => g.items.length > 0);

  const needsAction = (freshnessOf.size
    ? [...freshnessOf.values()].filter((s) => s !== "current").length
    : 0);

  return (
    <div className="flex flex-col gap-7">
      <Header sources={sources} />

      <p className="w-fit bg-background text-[13px] text-muted-foreground">
        <span className="font-semibold text-foreground">{needsAction}</span> of {sources.length}{" "}
        documents are due for review. Worked oldest-first within each band.
      </p>

      <div className="flex flex-col gap-7">
        {groups.map(({ state, items }) => (
          <section key={state} className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2.5 border-b-2 border-border-strong pb-2">
              <span aria-hidden className={cn("size-2.5 translate-y-px rounded-full", FRESHNESS_META[state].dot)} />
              <h2 className="bg-background text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
                {FRESHNESS_META[state].label}
              </h2>
              <span className="bg-background text-[12.5px] text-muted-foreground">{STATE_BLURB[state]}</span>
              <span className="ml-auto bg-background font-mono text-[11px] tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </div>
            <ul className="overflow-hidden rounded-[4px] border border-border bg-card">
              {items.map((source, i) => (
                <li key={source.id} className={cn(i > 0 && "border-t border-border")}>
                  <BoardRow source={source} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function BoardRow({ source }: { source: Source }) {
  return (
    <Link
      to="/sources/$sourceId"
      params={{ sourceId: source.id }}
      className={cn(
        "group grid items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]",
        "transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2.5">
          <span className="text-[13.5px] font-bold tracking-[-0.01em] text-foreground group-hover:text-brand-ink">
            {source.title}
          </span>
          <AuthorityBadge level={source.authority_level} />
        </span>
        <code className="font-mono text-[10.5px] text-muted-foreground">
          {CLASS_LABEL[source.source_class]} · {source.id}
        </code>
      </span>
      <span className="flex items-center gap-4 sm:justify-end">
        <span className="flex flex-col sm:items-end">
          <span className="text-[12px] font-medium text-foreground">{source.steward}</span>
          <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
            reviewed {reviewedLabel(source)}
          </span>
        </span>
        <IconArrowRight
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink"
        />
      </span>
    </Link>
  );
}
