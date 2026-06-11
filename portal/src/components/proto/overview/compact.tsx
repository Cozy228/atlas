/**
 * PROTOTYPE (production candidate) — Operations "Compact" dashboard.
 *
 * The same snapshot, distilled to a single screen: a one-line condition strip,
 * the top of the "needs attention" feed, and a tight fleet list — no sparklines,
 * no wide tables. The lean read for a glance, paired with the merged Dashboard.
 */
import {
  APP_SERVICES,
  deployStatusCounts,
  deploysToday,
  healthSummary,
  needsAttention,
  openIncidents,
} from "@/lib/ops";
import { cn } from "@/lib/utils";

import { DashHeader } from "./metrics";
import { AttentionFeed, HealthDot } from "./shared";

export function OverviewCompact() {
  const summary = healthSummary();
  const counts = deployStatusCounts();
  const open = openIncidents();
  const attention = needsAttention();

  return (
    <div className="flex flex-col gap-6">
      <DashHeader lede="The platform at a glance: condition, what needs attention, and the fleet — one screen." />

      <section
        aria-label="Conditions"
        className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-[4px] border border-border bg-card sm:grid-cols-5 sm:divide-y-0"
      >
        <Stat value={`${summary.healthy}/${summary.total}`} label="healthy" />
        <Stat value={summary.degraded} label="degraded" warn={summary.degraded > 0} />
        <Stat value={open.length} label="open incidents" warn={open.length > 0} />
        <Stat value={deploysToday()} label="deploys today" />
        <Stat value={`${counts.failed}`} label="failed deploys" warn={counts.failed > 0} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="Needs attention" className="flex flex-col gap-2.5">
          <h2 className="flex items-baseline justify-between gap-2">
            <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Needs attention
            </span>
            <span className="bg-background font-mono text-[10.5px] tabular-nums text-muted-foreground">
              top {Math.min(4, attention.length)} of {attention.length}
            </span>
          </h2>
          <AttentionFeed items={attention} limit={4} />
        </section>

        <section aria-label="Fleet" className="flex flex-col gap-2.5">
          <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Fleet · {APP_SERVICES.length} services
          </span>
          <ul className="overflow-hidden rounded-[4px] border border-border bg-card">
            {APP_SERVICES.map((s, i) => (
              <li
                key={s.id}
                className={cn(
                  "flex items-center justify-between gap-3 px-3.5 py-2",
                  i > 0 && "border-t border-border",
                  s.health === "degraded" && "bg-warning/[0.06]",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <HealthDot health={s.health} />
                  <span className="truncate text-[12.5px] font-semibold text-foreground">{s.name}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3 font-mono text-[11px] tabular-nums text-muted-foreground">
                  <span>{s.uptime}</span>
                  <span className={cn(s.health === "degraded" && "font-semibold text-warning")}>{s.p99}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Stat({ value, label, warn }: { value: string | number; label: string; warn?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 px-3.5 py-3">
      <span className={cn("text-[1.375rem] font-bold tabular-nums tracking-[-0.02em] text-foreground", warn && "text-warning")}>
        {value}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
    </div>
  );
}
