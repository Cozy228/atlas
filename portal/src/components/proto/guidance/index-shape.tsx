/**
 * PROTOTYPE (production candidate) — Guidance index direction "By shape".
 *
 * Organised by the kind of journey rather than the destination: Walkthroughs
 * (do these in order), Decisions (choose a path), Checklists (verify before you
 * ship). A different organizing axis from the outcome-band default. Rows land
 * on the proto detail.
 */
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import {
  FLOW_SHAPE,
  FLOW_SHAPE_BLURB,
  flowMetric,
  scaledFlowTotal,
  scaledFlowsByShape,
} from "./catalog";
import { GuidanceStatusBadge, TYPE_META } from "./shared";

export function GuidanceIndexShape() {
  const groups = scaledFlowsByShape();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="w-fit bg-background text-2xl font-bold tracking-[-0.02em] text-foreground">
          Guidance
        </h1>
        <p className="w-fit max-w-[60ch] bg-background text-[13.5px] leading-[1.55] text-muted-foreground">
          {scaledFlowTotal()} flows, sorted by the kind of journey each one is. Pick the shape that
          fits how you need to work.
        </p>
      </header>

      {groups.map(({ type, items }) => {
        const Icon = TYPE_META[type].icon;
        return (
          <section key={type} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 border-b-2 border-border-strong pb-2">
              <Icon aria-hidden className="size-4 shrink-0 text-foreground" />
              <h2 className="bg-background text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
                {FLOW_SHAPE[type]}s
              </h2>
              <span className="bg-background text-[12.5px] text-muted-foreground">
                {FLOW_SHAPE_BLURB[type]}
              </span>
              <span className="ml-auto shrink-0 bg-background font-mono text-[10.5px] tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </div>
            <ul className="grid gap-x-8 gap-y-px sm:grid-cols-2">
              {items.map((guidance) => {
                const metric = flowMetric(guidance);
                return (
                  <li key={guidance.id}>
                    <Link
                      to="/proto/guidance/$guidanceId"
                      params={{ guidanceId: guidance.id }}
                      search={{ variant: "board" }}
                      className={cn(
                        "group flex items-baseline gap-3 rounded-[4px] px-2.5 py-2.5",
                        "transition-colors hover:bg-muted/60",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      )}
                    >
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex items-baseline gap-2">
                          <span className="truncate text-[13.5px] font-bold tracking-[-0.01em] text-foreground group-hover:text-brand-ink">
                            {guidance.title}
                          </span>
                          <GuidanceStatusBadge status={guidance.status} />
                        </span>
                        <span className="truncate text-[12px] text-muted-foreground">
                          {guidance.destination.title}
                        </span>
                      </span>
                      <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] tabular-nums text-muted-foreground">
                        {metric.value} {metric.unit}
                      </span>
                      <IconArrowRight
                        aria-hidden
                        className="size-3.5 shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
