/**
 * PROTOTYPE (production candidate) — Operations "Dashboard" (merged default).
 *
 * The consolidated read, folding the three round-3 directions into one: the KPI
 * scorecard (with sparklines), the condition gauge + priority "needs attention"
 * feed (from Pulse), the fleet health table (from Scorecard), and the
 * dev → staging → prod promotion state in a lighter form — a "pending
 * promotions" rail plus a prod-state column (from the Signal grid).
 */
import { Link } from "@tanstack/react-router";

import {
  APP_SERVICES,
  DEPLOYMENTS,
  INCIDENTS,
  KPI_SPARKS,
  deployStatusCounts,
  deploysToday,
  healthSummary,
  needsAttention,
  openIncidents,
  pendingPromotions,
  type AppService,
} from "@/lib/ops";
import { cn } from "@/lib/utils";

import { ConditionGauge, DashHeader, KpiCard, Sparkline, sparkSeries } from "./metrics";
import { AttentionFeed, DeployStatusGlyph, EnvTag, HealthDot } from "./shared";

const HEALTH_TREND_TONE: Record<AppService["health"], string> = {
  healthy: "text-success",
  degraded: "text-warning",
  down: "text-critical",
};

export function OverviewDashboard() {
  const summary = healthSummary();
  const counts = deployStatusCounts();
  const open = openIncidents();
  const attention = needsAttention();
  const pct = Math.round((summary.healthy / summary.total) * 100);

  return (
    <div className="flex flex-col gap-7">
      <DashHeader lede="How the applications on the platform are doing right now: health, deploys, and incidents." />

      <section aria-label="Key metrics" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Services healthy"
          value={`${summary.healthy}/${summary.total}`}
          note={summary.degraded > 0 ? `${summary.degraded} degraded` : "all green"}
          spark={sparkSeries("fleet-health", 12)}
          sparkTone="success"
        />
        <KpiCard
          label="Open incidents"
          value={open.length}
          note="1 SEV-2 monitoring"
          spark={KPI_SPARKS.openIncidents}
          sparkTone="warning"
        />
        <KpiCard
          label="Deploys today"
          value={deploysToday()}
          note={`${counts.failed} failed · ${counts.running} running`}
          spark={KPI_SPARKS.deploysPerDay}
          sparkTone="info"
        />
        <KpiCard
          label="Prod error rate"
          value="0.04"
          unit="%"
          note="peak 0.34% at 04:00"
          spark={KPI_SPARKS.prodErrorRate}
          sparkTone="warning"
          area
        />
      </section>

      <section aria-label="Condition and attention" className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col items-center gap-4 rounded-[4px] border border-border bg-card p-5">
          <ConditionGauge pct={pct} label="healthy" />
          <dl className="grid w-full grid-cols-3 gap-2 border-t border-border pt-4 text-center">
            <Figure value={summary.total} label="services" />
            <Figure value={summary.degraded} label="degraded" warn={summary.degraded > 0} />
            <Figure value={open.length} label="incidents" warn={open.length > 0} />
          </dl>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          <h2 className="flex items-baseline justify-between gap-2">
            <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Needs attention
            </span>
            <span className="bg-background font-mono text-[10.5px] tabular-nums text-muted-foreground">
              {attention.length} items
            </span>
          </h2>
          <AttentionFeed items={attention} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <FleetTable />
        <div className="flex min-w-0 flex-col gap-6">
          <PendingPromotions />
          <DeploymentsPanel />
          <IncidentsLink resolved={INCIDENTS.length - open.length} />
        </div>
      </div>
    </div>
  );
}

function Figure({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <dd className={cn("text-[1.125rem] font-bold tabular-nums text-foreground", warn && "text-warning")}>
        {value}
      </dd>
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">{label}</dt>
    </div>
  );
}

function FleetTable() {
  return (
    <section aria-label="Fleet health" className="flex flex-col gap-2.5">
      <h2 className="w-fit bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Fleet health · {APP_SERVICES.length} services
      </h2>
      <div className="overflow-x-auto rounded-[4px] border border-border bg-card">
        <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-muted text-left font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
              <th className="px-3.5 py-2 font-semibold">Service</th>
              <th className="px-3 py-2 font-semibold">Health</th>
              <th className="px-3 py-2 text-right font-semibold">Uptime</th>
              <th className="px-3 py-2 text-right font-semibold">Err 1h</th>
              <th className="px-3 py-2 text-right font-semibold">p99</th>
              <th className="px-3 py-2 font-semibold">Trend</th>
              <th className="px-3 py-2 font-semibold">Prod</th>
            </tr>
          </thead>
          <tbody>
            {APP_SERVICES.map((s, i) => {
              const ahead = s.versions.prod !== s.versions.staging || s.versions.staging !== s.versions.dev;
              return (
                <tr
                  key={s.id}
                  className={cn(
                    i > 0 && "border-t border-border",
                    s.health === "degraded" && "bg-warning/[0.06]",
                  )}
                >
                  <td className="px-3.5 py-2.5">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{s.name}</span>
                      <span className="text-[11px] text-muted-foreground">{s.team}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <HealthDot health={s.health} />
                      <span className="capitalize text-foreground">{s.health}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{s.uptime}</td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right tabular-nums",
                      s.health === "degraded" ? "font-semibold text-warning" : "text-foreground",
                    )}
                  >
                    {s.errorRate}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{s.p99}</td>
                  <td className="px-3 py-2.5">
                    <Sparkline values={sparkSeries(s.id, 14)} width={80} height={22} className={HEALTH_TREND_TONE[s.health]} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] tabular-nums text-foreground">{s.versions.prod}</span>
                      {ahead ? (
                        <span
                          title="A newer version is staged — pending promotion"
                          className="font-mono text-[9.5px] uppercase tracking-[0.04em] text-info-ink"
                        >
                          ↑ pend
                        </span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PendingPromotions() {
  const pending = pendingPromotions();
  return (
    <section aria-label="Pending promotions" className="flex flex-col gap-2.5">
      <h2 className="flex items-baseline justify-between gap-2">
        <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Pending promotions
        </span>
        <span className="bg-background font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {pending.length}
        </span>
      </h2>
      <ul className="overflow-hidden rounded-[4px] border border-border bg-card">
        {pending.map((s, i) => (
          <li key={s.id} className={cn("flex items-center justify-between gap-3 px-3.5 py-2.5", i > 0 && "border-t border-border")}>
            <span className="truncate text-[12.5px] font-semibold text-foreground">{s.name}</span>
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">
              <span>{s.versions.prod}</span>
              <span aria-hidden className="text-info">→</span>
              <span className="text-info-ink">{s.versions.staging}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DeploymentsPanel() {
  const recent = DEPLOYMENTS.slice(0, 5);
  return (
    <section aria-label="Recent deployments" className="flex flex-col gap-2.5">
      <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Recent deploys
      </span>
      <ul className="overflow-hidden rounded-[4px] border border-border bg-card">
        {recent.map((d, i) => (
          <li key={d.id} className={cn("flex items-center gap-2.5 px-3.5 py-2.5", i > 0 && "border-t border-border")}>
            <DeployStatusGlyph status={d.status} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12.5px] font-semibold text-foreground">{d.service}</span>
              <span className="truncate font-mono text-[10.5px] text-muted-foreground">{d.ref}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <EnvTag env={d.env} />
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{d.at}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function IncidentsLink({ resolved }: { resolved: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[4px] border border-border bg-card px-3.5 py-3">
      <span className="text-[12.5px] text-muted-foreground">{resolved} incidents resolved this week</span>
      <Link to="/proto/whatsnew" className="text-[12px] font-semibold text-brand-ink hover:underline">
        Activity →
      </Link>
    </div>
  );
}
