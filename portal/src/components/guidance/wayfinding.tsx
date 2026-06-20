/**
 * shared kit for the `/guidance` index
 * directions (Console / Catalog / Directory).
 *
 * The index is filed by category, and the one recommendation it makes is simply
 * what you have running. Shared here: a per-category icon, a `NextStop` card
 * (the in-flight flow framed as the move to resume), and one `useResume` hook
 * that reads local progress and surfaces unfinished flows + their category.
 */
import { useEffect, useMemo, useState } from "react";
import {
  IconActivity,
  IconArrowRight,
  IconDatabase,
  IconRocket,
  IconShieldLock,
  IconStack2,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import type { Guidance } from "@/lib/guidance";
import { readAllProgress } from "@/lib/guidance-progress";
import { cn } from "@/lib/utils";

import { allGuidance, type CategoryGroup } from "./catalog";
import { CORNER_TICKS } from "./parts";
import { completableSteps } from "./shared";

/* -------------------------------------------------------------------------- *
 * Category marks — one glyph per category so each reads as a distinct place.
 * -------------------------------------------------------------------------- */

export const CATEGORY_ICON: Record<string, Icon> = {
  applications: IconRocket,
  data: IconDatabase,
  security: IconShieldLock,
  operations: IconActivity,
  platform: IconStack2,
};
export const categoryIcon = (id: string): Icon => CATEGORY_ICON[id] ?? IconRocket;

/* -------------------------------------------------------------------------- *
 * Gate — a route's publish status read as a transit "gate" state.
 * -------------------------------------------------------------------------- */

type GateTone = "open" | "hold" | "draft" | "closed";
const GATE: Record<Guidance["status"], { label: string; tone: GateTone }> = {
  published: { label: "Open", tone: "open" },
  needs_review: { label: "Hold", tone: "hold" },
  draft: { label: "Draft", tone: "draft" },
  deprecated: { label: "Closed", tone: "closed" },
};
const GATE_DOT: Record<GateTone, string> = {
  open: "bg-success",
  hold: "bg-warning",
  draft: "bg-muted-foreground/50",
  closed: "bg-critical",
};
function gateOf(status: Guidance["status"]) {
  return GATE[status];
}

/* -------------------------------------------------------------------------- *
 * Resume — read local progress and surface the unfinished flows, most-advanced
 * first. These in-flight flows ARE the recommendation.
 * -------------------------------------------------------------------------- */

export type Resumable = { guidance: Guidance; done: number; total: number; categoryIndex: number };

export function useResume(groups: ReadonlyArray<CategoryGroup>): {
  resumable: ReadonlyArray<Resumable>;
  nextIndex: number;
  started: boolean;
  hydrated: boolean;
} {
  const flows = useMemo(() => allGuidance(), []);
  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    groups.forEach((group, i) => group.items.forEach((g) => map.set(g.id, i)));
    return map;
  }, [groups]);

  const [progress, setProgress] = useState<Record<string, ReadonlySet<string>> | null>(null);
  useEffect(() => setProgress(readAllProgress()), []);

  return useMemo(() => {
    const resumable: Resumable[] = [];
    for (const g of flows) {
      const completed = progress?.[g.id];
      if (!completed || completed.size === 0) continue;
      const steps = completableSteps(g);
      const done = steps.filter((s) => completed.has(s.id)).length;
      if (done === 0 || done >= steps.length) continue;
      const categoryIndex = indexOf.get(g.id) ?? -1;
      resumable.push({ guidance: g, done, total: steps.length, categoryIndex });
    }
    resumable.sort((a, b) => b.done / b.total - a.done / a.total);
    // The next stop IS what you have running; nothing in flight ⇒ no recommendation.
    const nextIndex = resumable[0]?.categoryIndex ?? -1;
    return { resumable, nextIndex, started: resumable.length > 0, hydrated: progress !== null };
  }, [flows, progress, indexOf]);
}

/* -------------------------------------------------------------------------- *
 * Next stop — the signature object. The thing you have running IS the route you
 * take next, so this is the recommendation: a boarding pass for the in-flight
 * flow, stated NOW (its leg) → NEXT (its destination), with a live progress bar
 * and a "resume" tear-off. With nothing in flight a direction shows nothing
 * here — there is no recommendation to make.
 * -------------------------------------------------------------------------- */

/**
 * Next stop(s) — the in-flight flows, the only recommendation the index makes.
 * One card sits at a readable width; several lay out as a grid so each stays
 * narrow. Nothing in flight ⇒ renders nothing.
 */
export function NextStops({
  resumable,
  groups,
}: {
  resumable: ReadonlyArray<Resumable>;
  groups: ReadonlyArray<CategoryGroup>;
}) {
  if (resumable.length === 0) return null;
  const multi = resumable.length > 1;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {multi ? "Pick up where you left off" : "Next stop"}
      </h2>
      <div className={cn("grid gap-3", multi ? "sm:grid-cols-2" : "max-w-[560px]")}>
        {resumable.map((r) => (
          <NextStop
            key={r.guidance.id}
            lead={r}
            fromCategory={groups[r.categoryIndex]?.category.label}
          />
        ))}
      </div>
    </section>
  );
}

export function NextStop({
  lead,
  fromCategory,
  className,
}: {
  lead: Resumable;
  /** The category the flow sits in, e.g. "Security" — shown as its origin. */
  fromCategory?: string;
  className?: string;
}) {
  const { guidance, done, total } = lead;
  const gate = gateOf(guidance.status);

  return (
    <Link
      to="/guidance/$guidanceId"
      params={{ guidanceId: guidance.id }}
      className={cn(
        "group relative grid grid-cols-[minmax(0,1fr)_3.5rem] overflow-hidden rounded-[6px] border border-line-2 bg-card",
        "transition-[border-color,box-shadow] hover:border-line-2 hover:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_16px_-8px_rgb(0_0_0/0.14)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_4rem]",
        CORNER_TICKS,
        className,
      )}
    >
      {/* Main — the journey. */}
      <div className="flex flex-col gap-2 p-3">
        <span className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <span aria-hidden className="size-1 rounded-full bg-muted-foreground/50" />
          Next stop
        </span>

        <h3 className="truncate text-[14px] font-bold leading-tight tracking-[-0.02em] text-foreground group-hover:text-brand-ink">
          {guidance.title}
        </h3>

        <div className="flex items-center gap-2">
          {fromCategory ? <Leg label="Now" value={fromCategory} /> : null}
          <IconArrowRight aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          <Leg label="Next" value={guidance.destination.title} grow />
        </div>

        <div className="flex items-center gap-2.5 border-t border-dashed border-border pt-2">
          <span
            className="h-1 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={done}
          >
            <span
              className="block h-full rounded-full bg-brand"
              style={{ width: `${total > 0 ? Math.round((done / total) * 100) : 0}%` }}
            />
          </span>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
            {done}/{total}
          </span>
          <span className="hidden items-center gap-1 font-mono text-[10px] text-foreground sm:inline-flex">
            <span aria-hidden className={cn("size-1.5 rounded-full", GATE_DOT[gate.tone])} />
            {gate.label}
          </span>
        </div>
      </div>

      {/* Stub — the tear-off. Perforation notches sit on the dashed seam. */}
      <div className="relative flex flex-col items-center justify-center gap-2 border-l border-dashed border-border bg-brand-tint/50">
        <span
          aria-hidden
          className="absolute -top-1.5 left-0 size-3 -translate-x-1/2 rounded-full bg-background"
        />
        <span
          aria-hidden
          className="absolute -bottom-1.5 left-0 size-3 -translate-x-1/2 rounded-full bg-background"
        />
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-ink/60 [writing-mode:vertical-rl] rotate-180">
          Board
        </span>
        <span
          aria-hidden
          className="grid size-7 place-items-center rounded-full border border-brand/25 bg-surface text-brand-ink transition-transform duration-200 group-hover:translate-x-0.5"
        >
          <IconArrowRight className="size-3.5" />
        </span>
      </div>
    </Link>
  );
}

function Leg({ label, value, grow }: { label: string; value: string; grow?: boolean }) {
  return (
    <span className={cn("flex min-w-0 flex-col gap-0.5", grow && "flex-1")}>
      <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-[11.5px] font-semibold text-foreground">{value}</span>
    </span>
  );
}
