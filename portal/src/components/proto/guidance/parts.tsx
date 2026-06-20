/**
 * PROTOTYPE — shared parts for the `/proto/guidance` index directions.
 *
 * The wayfinding directions (Track / Triage / Next) differ in how they point you
 * onward, but they render a route the same way: one line, the title standing in
 * for the destination, with the real signal (owner, length, status) trailing
 * quietly. Keeping the row here keeps the three directions visually consistent.
 */
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";

import type { Guidance } from "@/lib/guidance";
import { cn } from "@/lib/utils";

import { journeyWeight } from "./catalog";
import { GuidanceStatusBadge } from "./shared";

/** Brand corner ticks (DESIGN.md §06): 7px L-brackets, opacity .5. */
export const CORNER_TICKS = cn(
  "before:pointer-events-none before:absolute before:-top-px before:-left-px before:size-[7px] before:border-t before:border-l before:border-brand before:opacity-50 before:content-['']",
  "after:pointer-events-none after:absolute after:-right-px after:-bottom-px after:size-[7px] after:border-r after:border-b after:border-brand after:opacity-50 after:content-['']",
);

/**
 * One route on a single line. Title is the destination — no second layer.
 *
 * When several routes are listed under one shared outcome (the alternatives on a
 * journey leg), pass `withDestination` so each row carries a route-stop node and
 * the end-state it reaches, so the list reads as distinct choices, not a dump.
 */
export function RouteLine({
  guidance,
  withDestination = false,
  className,
}: {
  guidance: Guidance;
  /** Show a leading stop node + the destination this route reaches. */
  withDestination?: boolean;
  className?: string;
}) {
  const steps = journeyWeight(guidance);
  const retired = guidance.status === "deprecated";

  return (
    <Link
      to="/proto/guidance/$guidanceId"
      params={{ guidanceId: guidance.id }}
      className={cn(
        "group flex items-center gap-3 rounded-[3px] py-2 pl-1 pr-2",
        "transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        retired && "opacity-60",
        className,
      )}
    >
      {withDestination ? (
        <span
          aria-hidden
          className="size-1.5 shrink-0 rounded-full border border-border-strong transition-colors group-hover:border-brand-ink"
        />
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[14px] font-semibold tracking-[-0.01em] text-foreground group-hover:text-brand-ink">
          {guidance.title}
        </span>
        {withDestination ? (
          <span className="truncate text-[12px] leading-snug text-muted-foreground">
            {guidance.destination.title}
          </span>
        ) : null}
      </span>
      <GuidanceStatusBadge status={guidance.status} />
      {withDestination ? null : (
        <span className="hidden shrink-0 truncate text-[12px] text-muted-foreground sm:block sm:max-w-[11rem]">
          {guidance.owner.team}
        </span>
      )}
      <span className="w-[4.25rem] shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {steps} steps
      </span>
      <IconArrowRight
        aria-hidden
        className="size-4 shrink-0 text-brand-ink opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
      />
    </Link>
  );
}
