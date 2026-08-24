/**
 * Prototype `atlas` — Workbench Overview
 * ======================================
 * docs/app-centric-experience-architecture.md §6d. The landing face inside an
 * application carries exactly four kinds of content, derived from why people
 * open an app page:
 *
 *   A Health verdict      — is this app OK, per environment (five-tests: understand failure)
 *   B Needs you           — failures / blockers / waits aggregated onto this app (act next)
 *   C Recent activity     — deployments and platform advisories, newest first (verify results)
 *   D Ownership & links   — who owns it, where it lives (find humans) → right drawer,
 *                           off the first screen until asked.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconAlertTriangle,
  IconArrowNarrowRight,
  IconClockPause,
  IconInfoCircle,
  IconLockExclamation,
  IconShieldExclamation,
  IconX,
} from "@tabler/icons-react";

import logoSvg from "@/assets/logo.svg?url";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  CURRENT_USER,
  FIXTURE_NOW,
  ago,
  attentionItems,
  connections,
  deriveVerdict,
  journeySummary,
  recentActivity,
  type ActivityEntry,
  type AppVerdict,
  type Application,
  type AttentionItem,
  type VerdictTone,
} from "./fixtures";
import { Chip, Eyebrow, Id, Panel, Sparkline, StatusDot } from "./ui";

export function OverviewPage({ application }: { application: Application }) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const verdict = deriveVerdict(application);
  const attention = attentionItems(application);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 bg-background pr-1">
        <div className="min-w-0">
          <Eyebrow>Workbench</Eyebrow>
          <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.02em] text-foreground">
            Overview
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setAboutOpen(true)}>
          <IconInfoCircle size={14} aria-hidden />
          About
        </Button>
      </header>

      {/* A — health verdict */}
      <VerdictBlock appId={application.id} verdict={verdict} />

      {/* B — needs you */}
      <NeedsYouSection appId={application.id} items={attention} />

      {/* C — recent activity */}
      <ActivitySection appId={application.id} entries={recentActivity(application)} />

      {/* D — about drawer */}
      {aboutOpen ? (
        <AboutDrawer application={application} onClose={() => setAboutOpen(false)} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A — health verdict                                                  */
/* ------------------------------------------------------------------ */

const TONE_BLOCK: Record<VerdictTone, string> = {
  healthy: "border-success/30 bg-success/[0.06]",
  attention: "border-warning/40 bg-warning/[0.08]",
  critical: "border-critical/35 bg-critical/[0.06]",
};

function VerdictBlock({ appId, verdict }: { appId: string; verdict: AppVerdict }) {
  return (
    <Panel ticks className={cn("overflow-hidden", TONE_BLOCK[verdict.tone])}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-4 py-3.5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[15px] font-bold tracking-[-0.01em] text-foreground">
            <StatusDot
              state={
                verdict.tone === "healthy"
                  ? "healthy"
                  : verdict.tone === "attention"
                    ? "degraded"
                    : "critical"
              }
            />
            {verdict.headline}
          </p>
          <p className="mt-1 max-w-[65ch] text-[12.5px] leading-[1.5] text-muted-foreground">
            {verdict.notice}
          </p>
        </div>
        {verdict.tone === "critical" ? (
          <Button size="sm" render={<Link to="/prototype/$appId/delivery" params={{ appId }} />}>
            Diagnose
            <IconArrowNarrowRight size={14} aria-hidden />
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 border-t border-border/60 sm:grid-cols-3">
        {verdict.metrics.map((metric) => {
          const isNumeric = metric.value !== "—";
          const sparkData =
            metric.id === "error-rate"
              ? [0.08, 0.1, 0.09, 0.14, 0.11, 0.12, 0.12]
              : metric.id === "p95"
                ? [240, 235, 220, 218, 225, 215, 212]
                : [99.99, 99.98, 99.99, 99.97, 99.98, 99.99, 99.98];

          return (
            <div
              key={metric.id}
              className="border-b border-border/60 px-4 py-3 sm:border-b-0 [&:not(:last-child)]:sm:border-r [&:not(:last-child)]:sm:border-border/60 flex flex-col justify-between"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {metric.label}
                </p>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <p className="text-[20px] font-semibold leading-none tabular-nums text-foreground">
                    {metric.value}
                  </p>
                  {isNumeric && (
                    <Sparkline
                      data={sparkData}
                      tone={metric.id === "error-rate" ? "neutral" : "success"}
                    />
                  )}
                </div>
              </div>
              {metric.note !== undefined && (
                <p className="mt-1 max-w-[28ch] text-[11px] leading-[1.45] text-muted-foreground">
                  {metric.note}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {verdict.environments.map((env) => (
            <span
              key={env.environment}
              className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
            >
              <StatusDot state={env.state} />
              {env.environment}
              <span className="text-[11px]">{envStateLabel(env.state)}</span>
            </span>
          ))}
        </span>
        <Chip tone="neutral">observed · cloud runtime</Chip>
      </footer>
    </Panel>
  );
}

function envStateLabel(state: "healthy" | "degraded" | "unknown"): string {
  switch (state) {
    case "healthy":
      return "live";
    case "degraded":
      return "degraded";
    case "unknown":
      return "not deployed yet";
  }
}

/* ------------------------------------------------------------------ */
/* B — needs you                                                       */
/* ------------------------------------------------------------------ */

const ATTENTION_ICON = {
  failure: IconAlertTriangle,
  blocked: IconLockExclamation,
  waiting: IconClockPause,
  advisory: IconShieldExclamation,
  "data-quality": IconAlertTriangle,
} as const;

function NeedsYouSection({ appId, items }: { appId: string; items: ReadonlyArray<AttentionItem> }) {
  if (items.length === 0) {
    return (
      <div className="rounded-[4px] border border-border/80 bg-surface/50 p-4 text-[13px] text-muted-foreground flex items-center justify-between">
        <span>No blocking actions waiting on you for this application.</span>
        <Chip tone="success">All clean ✓</Chip>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-1">
        <span>
          Action Queue · {items.length} Required Action{items.length === 1 ? "" : "s"}
        </span>
        <span>Prioritized by Impact</span>
      </div>

      <div className="flex flex-col divide-y divide-border rounded-[4px] border border-border bg-surface overflow-hidden shadow-xs">
        {items.map((item) => {
          const isFailure = item.kind === "failure" || item.kind === "blocked";
          const isAdvisory = item.kind === "advisory";
          const Icon = ATTENTION_ICON[item.kind];

          return (
            <div
              key={item.id}
              className={cn(
                "flex items-start justify-between gap-3 p-3.5 transition-colors hover:bg-secondary/40",
                isFailure
                  ? "border-l-4 border-l-critical"
                  : isAdvisory
                    ? "border-l-4 border-l-brand"
                    : "border-l-4 border-l-warning",
              )}
            >
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-[3px]",
                    isFailure
                      ? "bg-critical/15 text-critical-ink"
                      : isAdvisory
                        ? "bg-brand/15 text-brand-ink"
                        : "bg-warning/20 text-warning-ink",
                  )}
                >
                  <Icon size={14} aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-bold text-foreground leading-tight">
                      {item.title}
                    </p>
                    <Chip
                      tone={isFailure ? "critical" : isAdvisory ? "brand" : "warning"}
                      className="font-mono text-[9.5px]"
                    >
                      {item.kind}
                    </Chip>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground max-w-[65ch]">
                    {item.why}
                  </p>
                  <p className="mt-1 font-mono text-[10.5px] text-muted-foreground">
                    Held by {item.holder.label.toLowerCase()}
                    {item.since !== undefined ? ` · waiting ${ago(item.since)}` : ""}
                  </p>
                </div>
              </div>

              <div className="shrink-0 pt-0.5">
                <Button
                  variant={isFailure ? "default" : "outline"}
                  size="xs"
                  render={
                    <Link
                      to={isFailure ? "/prototype/$appId/delivery" : "/prototype/$appId/overview"}
                      params={{ appId }}
                    />
                  }
                >
                  {isFailure ? "Diagnose" : "Inspect"}
                  <IconArrowNarrowRight size={12} aria-hidden />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* C — recent activity                                                 */
/* ------------------------------------------------------------------ */

function ActivitySection({
  appId,
  entries,
}: {
  appId: string;
  entries: ReadonlyArray<ActivityEntry>;
}) {
  const dated = entries.map((entry) => ({ entry, day: dayLabel(entry.at) }));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-1">
        <span>Recent Activity · Cross-Platform Event Stream</span>
        <span>CI/CD & SCM Synced</span>
      </div>

      <div className="rounded-[4px] border border-border bg-surface overflow-hidden">
        <ol className="flex flex-col divide-y divide-border">
          {dated.map(({ entry, day }, index) => {
            const showDay = index === 0 || dated[index - 1]?.day !== day;
            return (
              <li key={entry.id} className="flex flex-col">
                {showDay ? (
                  <p className="bg-surface-2 px-4 py-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground border-b border-border/60">
                    {day}
                  </p>
                ) : null}
                <ActivityRow entry={entry} appId={appId} />
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function ActivityRow({ entry, appId }: { entry: ActivityEntry; appId: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-border px-4 py-2.5 first:border-t-0">
      {entry.kind === "run" ? (
        <>
          <RunMark state={entry.run.result} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{entry.run.label}</p>
            <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
              <Id>{entry.run.id}</Id> · {entry.run.environment} ·{" "}
              <span
                className={cn(
                  "font-medium capitalize",
                  entry.run.result === "failed"
                    ? "text-critical-ink"
                    : entry.run.result === "succeeded"
                      ? "text-success-ink"
                      : "text-muted-foreground",
                )}
              >
                {entry.run.result}
              </span>
              {entry.run.diagnosisId !== undefined ? " · diagnosis available" : ""}
            </p>
          </div>
          <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
            {ago(entry.at)}
          </span>
          {entry.run.diagnosisId !== undefined ? (
            <Button
              variant="ghost"
              size="xs"
              render={<Link to="/prototype/$appId/delivery" params={{ appId }} />}
            >
              Open
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[3px] bg-info/10">
            <IconInfoCircle size={14} aria-hidden className="text-info-ink" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{entry.label}</p>
            <p className="mt-0.5 max-w-[60ch] text-[11.5px] leading-[1.5] text-muted-foreground">
              {entry.summary}
            </p>
          </div>
          <Chip tone={entry.severity === "attention" ? "info" : "neutral"} className="shrink-0">
            advisory
          </Chip>
          <span className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted-foreground">
            {ago(entry.at)}
          </span>
        </>
      )}
    </div>
  );
}

function RunMark({ state }: { state: "succeeded" | "failed" | "running" | "waiting" }) {
  if (state === "failed") {
    return (
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[3px] bg-critical/10 text-[12px] font-bold text-critical-ink">
        ✕
      </span>
    );
  }
  if (state === "succeeded") {
    return (
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[3px] bg-success/10 text-[12px] font-bold text-success-ink">
        ✓
      </span>
    );
  }
  return (
    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[3px] bg-brand-tint">
      <span className="size-2 rounded-full bg-brand" aria-hidden />
    </span>
  );
}

/** Deterministic day bucket against the frozen fixture clock. */
function dayLabel(iso: string): string {
  const then = new Date(iso);
  const now = new Date(FIXTURE_NOW);
  const dayMs = 24 * 60 * 60 * 1000;
  const startOf = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const diffDays = Math.round((startOf(now) - startOf(then)) / dayMs);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/* ------------------------------------------------------------------ */
/* D — about drawer                                                    */
/* ------------------------------------------------------------------ */

function AboutDrawer({ application, onClose }: { application: Application; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const links = connections(application);
  const summary = journeySummary(application);

  return (
    <>
      <button
        type="button"
        aria-label="Close about panel"
        onClick={onClose}
        className="fixed inset-0 z-50 cursor-default bg-overlay/20"
      />
      <aside
        role="dialog"
        aria-label={`About ${application.name}`}
        className="fixed inset-y-0 right-0 z-50 flex w-[min(400px,92vw)] flex-col border-l border-border bg-card shadow-[0_0_24px_oklch(23%_0.03_264.18/0.18)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
          <div className="min-w-0">
            <Eyebrow>About</Eyebrow>
            <h2 className="mt-0.5 truncate text-[16px] font-bold tracking-[-0.01em] text-foreground">
              {application.name}
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{application.purpose}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <IconX size={15} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <section aria-label="Ownership" className="pb-4">
            <DrawerHeading>Ownership</DrawerHeading>
            <dl className="mt-2 flex flex-col divide-y divide-border rounded-[4px] border border-border">
              <DrawerRow label="Team" value={application.team} />
              <DrawerRow label="Tech lead" value={application.techLead} />
              <DrawerRow label="Contact" value={`${CURRENT_USER} · you`} />
              <DrawerRow label="Workload pattern" value={application.workloadPattern} />
              <DrawerRow
                label="Lifecycle"
                value={application.lifecycle === "onboarding" ? "Onboarding to DEV" : "Operating"}
              />
            </dl>
          </section>

          <section aria-label="Connections" className="pb-4">
            <DrawerHeading>Connections</DrawerHeading>
            <p className="mb-2 mt-1 text-[11.5px] leading-[1.5] text-muted-foreground">
              Where this application lives across systems. Jump to the source for details.
            </p>
            <ul className="flex flex-col divide-y divide-border rounded-[4px] border border-border">
              {links.map((link) => (
                <li key={link.label} className="flex items-start gap-2.5 px-3 py-2.5">
                  <span className="mt-0.5 grid h-5 w-8 shrink-0 place-items-center rounded-[3px] bg-secondary font-mono text-[9.5px] font-bold tracking-[0.04em] text-muted-foreground">
                    {link.mark}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-foreground">
                      {link.label}
                    </span>
                    <span className="block truncate font-mono text-[11.5px] font-semibold text-brand-ink">
                      {link.value}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      resolved from {link.systemName.toLowerCase()}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Journey standing" className="pb-2">
            <DrawerHeading>Journey standing</DrawerHeading>
            <p className="mt-1 text-[12.5px] leading-[1.55] text-muted-foreground">
              {summary.complete} of {summary.applicable} golden-path steps complete
              {summary.blockingStep !== undefined
                ? `, blocked at “${summary.blockingStep.title}”.`
                : "."}
            </p>
          </section>
        </div>

        <footer className="flex items-center gap-2 border-t border-border px-4 py-2.5">
          <img src={logoSvg} alt="" aria-hidden className="size-4 opacity-70" />
          <p className="text-[11px] leading-[1.45] text-muted-foreground">
            Fictional prototype data. Values resolve at their stated retrieval times.
          </p>
        </footer>
      </aside>
    </>
  );
}

function DrawerHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </h3>
  );
}

function DrawerRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3 py-2">
      <dt className="shrink-0 text-[12px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-[12.5px] font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}
