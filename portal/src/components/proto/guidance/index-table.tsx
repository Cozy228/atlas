/**
 * PROTOTYPE (production candidate) — Guidance index direction "Directory".
 *
 * Every flow in one dense table — outcome, shape, size, status — for scanning
 * at scale. The table register, distinct from the outcome-band default and the
 * by-shape view. Rows land on the proto detail.
 */
import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import { FLOW_SHAPE, allFlows, flowMetric, flowTotal } from "./catalog";
import { GuidanceStatusBadge } from "./shared";

export function GuidanceIndexTable() {
  const flows = allFlows();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="w-fit bg-background text-2xl font-bold tracking-[-0.02em] text-foreground">
          Guidance
        </h1>
        <p className="w-fit max-w-[60ch] bg-background text-[13.5px] leading-[1.55] text-muted-foreground">
          All {flowTotal()} maintained flows in one table — scan by outcome, shape, or size, then
          open the route.
        </p>
      </header>

      <div className="overflow-x-auto rounded-[4px] border border-border bg-card">
        <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-muted text-left font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="px-3.5 py-2 font-semibold">Flow</th>
              <th className="px-3 py-2 font-semibold">Outcome</th>
              <th className="px-3 py-2 font-semibold">Shape</th>
              <th className="px-3 py-2 text-right font-semibold">Size</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2" aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {flows.map(({ guidance, outcome }, i) => {
              const metric = flowMetric(guidance);
              return (
                <tr key={guidance.id} className={cn("group", i > 0 && "border-t border-border")}>
                  <td className="px-3.5 py-3">
                    <Link
                      to="/proto/guidance/$guidanceId"
                      params={{ guidanceId: guidance.id }}
                      search={{ variant: "board" }}
                      className="flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="font-bold tracking-[-0.01em] text-foreground group-hover:text-brand-ink">
                        {guidance.title}
                      </span>
                      <span className="text-[11.5px] text-muted-foreground">{guidance.destination.title}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{outcome}</td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground">
                      {FLOW_SHAPE[guidance.type]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-mono tabular-nums text-foreground">
                    {metric.value} {metric.unit}
                  </td>
                  <td className="px-3 py-3">
                    {guidance.status === "published" ? (
                      <span className="text-[11.5px] text-muted-foreground">Published</span>
                    ) : (
                      <GuidanceStatusBadge status={guidance.status} />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      to="/proto/guidance/$guidanceId"
                      params={{ guidanceId: guidance.id }}
                      search={{ variant: "board" }}
                      aria-label={`Open ${guidance.title}`}
                      className="flex justify-end focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <IconArrowRight
                        aria-hidden
                        className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-ink"
                      />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
