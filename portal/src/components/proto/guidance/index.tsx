/**
 * PROTOTYPE (production candidate) — Guidance index · route `/proto/guidance`
 * ==========================================================================
 * Round 2 redesign. The index is organised by *destination* — the outcome a
 * flow leaves you at — not the old scenario families. Each outcome is a band:
 * a left rail names where you'll end up, the right column lists the flows that
 * get you there. A flow's shape (Walkthrough / Decision / Checklist) and the
 * metric that fits it (steps / paths / checks) ride on the right of each row.
 *
 * Single direction (no variant switcher); rows land on the proto detail
 * `/proto/guidance/$guidanceId?variant=board`, which keeps its own board/line
 * register toggle.
 */
import { Link } from "@tanstack/react-router";
import { IconArrowRight, IconFlagFilled, IconHelpHexagon } from "@tabler/icons-react";

import type { Guidance } from "@/lib/guidance";
import { cn } from "@/lib/utils";

import {
  DESTINATION_GROUPS,
  FLOW_SHAPE,
  destinationGroups,
  flowMetric,
  flowTotal,
} from "./catalog";
import { GuidanceStatusBadge, TYPE_META } from "./shared";

export function GuidanceIndex() {
  const groups = destinationGroups();
  const total = flowTotal();

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="w-fit bg-background text-2xl font-bold tracking-[-0.02em] text-foreground">
          Guidance
        </h1>
        <p className="w-fit max-w-[60ch] bg-background text-[13.5px] leading-[1.55] text-muted-foreground">
          {total} maintained flows, filed by where they take you. Find the outcome you need, then
          follow the route that reaches it.
        </p>
      </header>

      {groups.map(({ group, items }) => (
        <section
          key={group.id}
          id={`outcome-${group.id}`}
          className="grid scroll-mt-20 gap-x-8 gap-y-3 md:grid-cols-[15rem_minmax(0,1fr)]"
        >
          {/* Left rail: the destination this band reaches. */}
          <div className="flex flex-col gap-1.5 md:pt-1">
            <div className="flex items-center gap-2">
              <IconFlagFilled aria-hidden className="size-3.5 shrink-0 text-success" />
              <h2 className="w-fit bg-background text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
                {group.outcome}
              </h2>
            </div>
            <p className="w-fit max-w-[40ch] bg-background text-[12.5px] leading-[1.5] text-muted-foreground">
              {group.blurb}
            </p>
            <span className="w-fit bg-background font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
              {items.length} {items.length === 1 ? "route" : "routes"}
            </span>
          </div>

          {/* Right column: the flows that reach it. */}
          <ul className="overflow-hidden rounded-[4px] border border-border bg-card">
            {items.map((guidance, i) => (
              <li key={guidance.id} className={cn(i > 0 && "border-t border-border")}>
                <FlowRow guidance={guidance} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Lost? hand off to the decision route. */}
      <aside className="flex flex-wrap items-center justify-between gap-3 rounded-[4px] border border-border bg-card px-5 py-4">
        <span className="flex items-center gap-2.5 text-[13.5px] text-muted-foreground">
          <IconHelpHexagon aria-hidden className="size-4.5 shrink-0" />
          Not sure where you need to end up? Start with the landing-zone decision and it hands you to
          the right route.
        </span>
        <Link
          to="/proto/guidance/$guidanceId"
          params={{ guidanceId: "landing-zone-selection" }}
          search={{ variant: "board" }}
          className="flex shrink-0 items-center gap-1 text-[13px] font-semibold text-brand-ink hover:underline"
        >
          Open the decision route
          <IconArrowRight aria-hidden className="size-3.5" />
        </Link>
      </aside>
    </div>
  );
}

/** One flow per line: shape icon · title + objective · destination · metric. */
function FlowRow({ guidance }: { guidance: Guidance }) {
  const ShapeIcon = TYPE_META[guidance.type].icon;
  const shape = FLOW_SHAPE[guidance.type];
  const metric = flowMetric(guidance);

  return (
    <Link
      to="/proto/guidance/$guidanceId"
      params={{ guidanceId: guidance.id }}
      search={{ variant: "board" }}
      className={cn(
        "group flex flex-col gap-1.5 px-4 py-3.5",
        "transition-colors hover:bg-muted/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      )}
    >
      <div className="flex items-center gap-2.5">
        <ShapeIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-[14px] font-bold tracking-[-0.01em] text-foreground group-hover:text-brand-ink">
          {guidance.title}
        </span>
        <GuidanceStatusBadge status={guidance.status} />
        <span className="hidden items-center gap-1.5 sm:flex">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground">
            {shape}
          </span>
          <span className="text-muted-foreground/40">·</span>
          <span className="whitespace-nowrap font-mono text-[10.5px] tabular-nums text-muted-foreground">
            {metric.value} {metric.unit}
          </span>
        </span>
        <IconArrowRight
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink"
        />
      </div>
      <p className="pl-[1.625rem] text-[12.5px] leading-[1.5] text-muted-foreground">
        {guidance.objective}
      </p>
      <p className="flex items-center gap-1.5 pl-[1.625rem] text-[12px] text-muted-foreground/90">
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground/70">
          ends at
        </span>
        <span className="min-w-0 truncate font-medium text-foreground/80">
          {guidance.destination.title}
        </span>
      </p>
    </Link>
  );
}

/** Quick anchor list for the page top, if a band jump is ever wired in. */
export const OUTCOME_ANCHORS = DESTINATION_GROUPS.map((g) => ({
  id: g.id,
  label: g.outcome,
}));
