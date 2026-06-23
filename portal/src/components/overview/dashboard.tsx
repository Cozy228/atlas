/**
 * Operations "Dashboard" (merged default).
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
  INCIDENTS,
  KPI_SPARKS,
  PIPELINES,
  SCANS,
  TFE_WORKSPACES,
  deployStatusCounts,
  deploysToday,
  healthSummary,
  needsAttention,
  openIncidents,
  openTickets,
  pendingPromotions,
  pipelineStatusCounts,
  scanGateCounts,
  scanTotals,
  type AppService,
  type TfeRunStatus,
} from "@/lib/ops";
import { cn } from "@/lib/utils";

import { ConditionGauge, DashHeader, KpiCard, Sparkline, sparkSeries } from "./metrics";
import {
  AttentionFeed,
  HealthDot,
  PipelineStageTrack,
  PriorityChip,
  ScanGateBadge,
  ticketKindLabel,
  ticketStatusLabel,
} from "./shared";

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

  const gates = scanGateCounts();
  const findings = scanTotals();
  const tickets = openTickets();
  const pipes = pipelineStatusCounts();

  return (
    <div className="flex flex-col gap-5">
      <DashHeader lede="How the applications on the platform are doing right now: health, delivery, security, and incidents." />

      <section aria-label="Key metrics" className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
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
          label="Scan findings"
          value={findings.critical + findings.high}
          note={`${findings.critical} critical · ${gates.fail} gate fail`}
          spark={KPI_SPARKS.prodErrorRate}
          sparkTone={findings.critical > 0 ? "critical" : "warning"}
          area
        />
      </section>

      <section
        aria-label="Condition and attention"
        className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]"
      >
        <div className="flex flex-col items-center gap-3 rounded-[4px] border border-border bg-card p-4">
          <ConditionGauge pct={pct} label="healthy" />
          <dl className="grid w-full grid-cols-3 gap-2 border-t border-border pt-3 text-center">
            <Figure value={summary.total} label="services" />
            <Figure value={summary.degraded} label="degraded" warn={summary.degraded > 0} />
            <Figure value={open.length} label="incidents" warn={open.length > 0} />
          </dl>
          <dl className="flex w-full flex-col gap-2 border-t border-border pt-3">
            <MiniStat label="Deploys today" value={deploysToday()} />
            <MiniStat label="Pipelines running" value={pipes.running} />
            <MiniStat label="Scan gates failing" value={gates.fail} warn={gates.fail > 0} />
            <MiniStat label="Open tickets" value={tickets.length} />
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

      <FleetTable />

      <section aria-label="Delivery and security" className="grid items-start gap-5 lg:grid-cols-2">
        <PipelinesPanel />
        <ScanPanel />
      </section>

      <TfeStatusPanel />

      <section
        aria-label="Promotions and tickets"
        className="grid items-start gap-5 lg:grid-cols-2"
      >
        <PendingPromotions />
        <TicketsPanel tickets={tickets} />
      </section>

      <IncidentsLink resolved={INCIDENTS.length - open.length} />
    </div>
  );
}

function MiniStat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-mono text-[12px] font-semibold tabular-nums text-foreground",
          warn && "text-warning",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function PipelinesPanel() {
  const recent = PIPELINES.slice(0, 5);
  return (
    <section aria-label="Pipelines" className="flex flex-col gap-2.5">
      <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        CI/CD pipelines
      </span>
      <ul className="overflow-hidden rounded-[4px] border border-border bg-card">
        {recent.map((run, i) => (
          <li
            key={run.id}
            className={cn(
              "flex flex-col gap-2 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between",
              i > 0 && "border-t border-border",
              run.status === "failed" && "bg-critical/[0.05]",
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[12.5px] font-semibold text-foreground">
                {run.service}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {run.id} · {run.trigger}
              </span>
            </span>
            <PipelineStageTrack stages={run.stages} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScanPanel() {
  const totals = scanTotals();
  return (
    <section aria-label="Security scans" className="flex flex-col gap-2.5">
      <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Security scans
      </span>
      <div className="flex flex-col gap-3 rounded-[4px] border border-border bg-card p-3.5">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <ScanFigure value={totals.critical} label="critical" tone="critical" />
          <ScanFigure value={totals.high} label="high" tone="warning" />
          <ScanFigure value={totals.medium} label="medium" />
        </dl>
        <ul className="flex flex-col border-t border-border pt-1">
          {SCANS.map((s, i) => (
            <li
              key={s.serviceId}
              className={cn(
                "flex items-center justify-between gap-3 py-1.5",
                i > 0 && "border-t border-border",
              )}
            >
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-[12px] text-foreground">{s.service}</span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  {s.critical}c · {s.high}h
                </span>
              </span>
              <ScanGateBadge gate={s.gate} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ScanFigure({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: "critical" | "warning";
}) {
  return (
    <div className="flex flex-col">
      <dd
        className={cn(
          "text-[1.25rem] font-bold tabular-nums text-foreground",
          value > 0 && tone === "critical" && "text-critical",
          value > 0 && tone === "warning" && "text-warning",
        )}
      >
        {value}
      </dd>
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
    </div>
  );
}

const TFE_STATUS_META: Record<TfeRunStatus, { label: string; dot: string; text: string }> = {
  applied: { label: "Applied", dot: "bg-success", text: "text-success" },
  planned: { label: "Planned", dot: "bg-info", text: "text-info-ink" },
  running: { label: "Running", dot: "bg-info", text: "text-info-ink" },
  errored: { label: "Errored", dot: "bg-critical", text: "text-critical" },
};

function TfeStatusPanel() {
  return (
    <section aria-label="Terraform workspaces" className="flex flex-col gap-2.5">
      <h2 className="flex items-baseline justify-between gap-2">
        <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Terraform workspaces · TFE
        </span>
        <span
          title="Read-only mirror of TFE run state. Fixture data — the live registry adapter is not yet wired."
          className="rounded-[2px] border border-border px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground"
        >
          fixture
        </span>
      </h2>
      <ul className="overflow-hidden rounded-[4px] border border-border bg-card">
        {TFE_WORKSPACES.map((ws, i) => {
          const meta = TFE_STATUS_META[ws.status];
          return (
            <li
              key={ws.name}
              className={cn(
                "flex items-center justify-between gap-3 px-3.5 py-2.5",
                i > 0 && "border-t border-border",
                ws.status === "errored" && "bg-critical/[0.05]",
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-[12px] font-semibold text-foreground">
                  {ws.name}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {ws.module} · {ws.version} · {ws.ranAt}
                </span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.04em]">
                <span aria-hidden className={cn("size-2 rounded-full", meta.dot)} />
                <span className={meta.text}>{meta.label}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function TicketsPanel({ tickets }: { tickets: ReturnType<typeof openTickets> }) {
  return (
    <section aria-label="Open tickets" className="flex flex-col gap-2.5">
      <h2 className="flex items-baseline justify-between gap-2">
        <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Open tickets
        </span>
        <span className="bg-background font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {tickets.length}
        </span>
      </h2>
      <ul className="overflow-hidden rounded-[4px] border border-border bg-card">
        {tickets.map((t, i) => (
          <li
            key={t.id}
            className={cn(
              "flex items-start gap-2.5 px-3.5 py-2",
              i > 0 && "border-t border-border",
            )}
          >
            <PriorityChip priority={t.priority} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12.5px] font-semibold text-foreground">
                {t.title}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {t.id} · {ticketKindLabel(t.kind)} · {ticketStatusLabel(t.status)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Figure({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <dd
        className={cn(
          "text-[1.125rem] font-bold tabular-nums text-foreground",
          warn && "text-warning",
        )}
      >
        {value}
      </dd>
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </dt>
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
              const ahead =
                s.versions.prod !== s.versions.staging || s.versions.staging !== s.versions.dev;
              return (
                <tr
                  key={s.id}
                  className={cn(
                    i > 0 && "border-t border-border",
                    s.health === "degraded" && "bg-warning/[0.06]",
                  )}
                >
                  <td className="px-3.5 py-2">
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{s.name}</span>
                      <span className="text-[11px] text-muted-foreground">{s.team}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <HealthDot health={s.health} />
                      <span className="capitalize text-foreground">{s.health}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">{s.uptime}</td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums",
                      s.health === "degraded" ? "font-semibold text-warning" : "text-foreground",
                    )}
                  >
                    {s.errorRate}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">{s.p99}</td>
                  <td className="px-3 py-2">
                    <Sparkline
                      values={sparkSeries(s.id, 14)}
                      width={80}
                      height={22}
                      className={HEALTH_TREND_TONE[s.health]}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] tabular-nums text-foreground">
                        {s.versions.prod}
                      </span>
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
  const shown = pending.slice(0, 4);
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
        {shown.map((s, i) => (
          <li
            key={s.id}
            className={cn(
              "flex items-center justify-between gap-3 px-3.5 py-2",
              i > 0 && "border-t border-border",
            )}
          >
            <span className="truncate text-[12.5px] font-semibold text-foreground">{s.name}</span>
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10.5px] tabular-nums text-muted-foreground">
              <span>{s.versions.prod}</span>
              <span aria-hidden className="text-info">
                →
              </span>
              <span className="text-info-ink">{s.versions.staging}</span>
            </span>
          </li>
        ))}
        {pending.length > shown.length ? (
          <li className="border-t border-border px-3.5 py-2 text-[11.5px] text-muted-foreground">
            +{pending.length - shown.length} more staged ahead of prod
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function IncidentsLink({ resolved }: { resolved: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[4px] border border-border bg-card px-3.5 py-3">
      <span className="text-[12.5px] text-muted-foreground">
        {resolved} incidents resolved this week
      </span>
      <Link to="/whatsnew" className="text-[12px] font-semibold text-brand-ink hover:underline">
        Activity →
      </Link>
    </div>
  );
}
