/**
 * Prototype `atlas` — Home triage desk
 * ====================================
 * docs/app-centric-experience-architecture.md §6b: Home is an identity route,
 * not a page with fixed content. For the N-applications case it renders the
 * only independent Home form — the triage desk: a cross-app inbox plus the
 * "pick one and go deep" choice. No portfolio dashboard (§1).
 */
import { Link } from "@tanstack/react-router";
import {
  IconAlertTriangle,
  IconArrowNarrowRight,
  IconClockPause,
  IconLockExclamation,
  IconPlus,
  IconRoute,
  IconShieldExclamation,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  APPLICATIONS,
  CURRENT_USER,
  attentionItems,
  deriveVerdict,
  journeySummary,
  type Application,
  type AttentionItem,
} from "./fixtures";
import { Chip, Eyebrow, Id, Panel, StatusDot } from "./ui";

export function HomePage() {
  const withState = APPLICATIONS.map((app) => ({
    app,
    verdict: deriveVerdict(app),
    journey: journeySummary(app),
    attention: attentionItems(app),
  }));

  const needsAttention = withState.filter((entry) => entry.verdict.tone !== "healthy");
  const healthy = withState.filter((entry) => entry.verdict.tone === "healthy");
  const inProgress = withState.filter(
    (entry) =>
      entry.app.lifecycle === "onboarding" &&
      entry.journey.progress > 0 &&
      entry.journey.progress < 1,
  );
  const crossAppItems = withState.flatMap((entry) =>
    entry.attention.map((item) => ({ item, entry })),
  );

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8">
      {/* ① Greeting + situation */}
      <header className="bg-background">
        <Eyebrow>Home</Eyebrow>
        <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-[-0.02em] text-foreground">
          Hi {CURRENT_USER}
        </h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          {APPLICATIONS.length} applications ·{" "}
          {needsAttention.length > 0 ? (
            <>
              <span className="font-semibold text-critical-ink">{needsAttention.length}</span> need
              attention
            </>
          ) : (
            "all quiet"
          )}
        </p>
      </header>

      {/* ② Continue — in-progress, resumable journeys across all apps */}
      {inProgress.length > 0 ? (
        <section aria-labelledby="home-continue" className="flex flex-col gap-3 bg-background">
          <SectionHeading id="home-continue" label="Continue" note="Across all your applications" />
          <div className="flex flex-col gap-2">
            {inProgress.map(({ app, journey }) => (
              <JourneyRow key={app.id} app={app} progress={journey} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ③ Needs you — failures / blockers / waits aggregated across apps */}
      {crossAppItems.length > 0 ? (
        <section aria-labelledby="home-needs-you" className="flex flex-col gap-3 bg-background">
          <SectionHeading
            id="home-needs-you"
            label="Needs you"
            note={`Across ${APPLICATIONS.length} applications · ${crossAppItems.length}`}
          />
          <Panel>
            <ul className="flex flex-col">
              {crossAppItems.map(({ item, entry }) => (
                <NeedItem
                  key={`${entry.app.id}-${item.id}`}
                  item={item}
                  appId={entry.app.id}
                  appCode={entry.app.code}
                />
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      {/* ④ My applications — triage: pick one and go deep */}
      <section aria-labelledby="home-my-apps" className="flex flex-col gap-3 bg-background">
        <SectionHeading id="home-my-apps" label="My applications" />
        {needsAttention.length > 0 ? (
          <>
            <p className="text-[12px] font-medium text-muted-foreground">Needs attention</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
              {needsAttention.map(({ app, verdict }) => (
                <AppCard key={app.id} app={app} verdict={verdict} />
              ))}
            </div>
          </>
        ) : null}
        {healthy.length > 0 ? (
          <div className="rounded-[4px] border border-border bg-card px-4 py-2.5">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
              <span className="font-medium">Healthy</span>
              {healthy.map(({ app }) => (
                <Link
                  key={app.id}
                  to="/prototype/$appId/overview"
                  params={{ appId: app.id }}
                  className="inline-flex items-center gap-1.5 text-foreground hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <StatusDot state="healthy" />
                  <span className="font-mono text-[11px] font-semibold">{app.code}</span>
                  <span>{app.name}</span>
                </Link>
              ))}
            </p>
          </div>
        ) : null}
      </section>

      {/* ⑤ Tail — start something new + platform notices */}
      <section className="grid grid-cols-1 gap-3 bg-background sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        <Link
          to="/prototype/onboard"
          className={cn(
            "group flex min-h-[92px] items-center justify-between gap-3 rounded-[4px] border border-dashed border-border-strong bg-card px-4 py-4 transition-colors",
            "hover:border-brand pop-hover",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-brand-tint text-brand-ink">
              <IconPlus size={18} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-bold tracking-[-0.01em] text-foreground">
                Onboard a new application
              </span>
              <span className="block text-[12px] text-muted-foreground">
                Managed-cloud golden path · first DEV deployment
              </span>
            </span>
          </span>
          <IconArrowNarrowRight
            size={16}
            aria-hidden
            className="shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-brand-ink"
          />
        </Link>

        <PlatformNotices />
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SectionHeading({ id, label, note }: { id?: string; label: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
        {label}
      </h2>
      {note !== undefined && <p className="text-[12px] text-muted-foreground">{note}</p>}
    </div>
  );
}

function JourneyRow({
  app,
  progress,
}: {
  app: Application;
  progress: ReturnType<typeof journeySummary>;
}) {
  const phase = app.journey.phases.find((candidate) => candidate.id === progress.currentPhaseId);
  return (
    <Link
      to="/prototype/$appId/overview"
      params={{ appId: app.id }}
      className={cn(
        "group flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[4px] border border-border bg-card px-4 py-3 transition-colors",
        "hover:border-border-strong pop-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground group-hover:text-brand-ink">
          <IconRoute size={16} aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-foreground">
            {app.journey.goldenPathLabel}
          </span>
          <span className="block truncate text-[12px] text-muted-foreground">
            <Id>{app.code}</Id> · {phase?.label ?? app.journey.goldenPathLabel}
          </span>
        </span>
      </span>
      <span className="ml-auto flex shrink-0 items-center gap-3">
        <span className="text-right">
          <span className="block text-[15px] font-semibold tabular-nums text-foreground">
            {progress.complete}
            <span className="text-[12px] font-normal text-muted-foreground">
              {" "}
              / {progress.applicable}
            </span>
          </span>
          <span className="block text-[11px] text-muted-foreground">steps done</span>
        </span>
        <Button variant="ghost" size="sm" tabIndex={-1}>
          Resume
          <IconArrowNarrowRight size={14} aria-hidden />
        </Button>
      </span>
    </Link>
  );
}

const NEED_ICON = {
  failure: IconAlertTriangle,
  blocked: IconLockExclamation,
  waiting: IconClockPause,
  advisory: IconShieldExclamation,
  "data-quality": IconAlertTriangle,
} as const;

function NeedItem({
  item,
  appId,
  appCode,
}: {
  item: AttentionItem;
  appId: string;
  appCode: string;
}) {
  const Icon = NEED_ICON[item.kind];
  const isFailure = item.kind === "failure";
  const target = isFailure ? "/prototype/$appId/delivery" : "/prototype/$appId/overview";
  const actionLabel = isFailure ? "Diagnose" : "Open";

  return (
    <li className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-[3px]",
          isFailure || item.kind === "blocked" ? "bg-critical/10" : "bg-warning/15",
        )}
      >
        <Icon
          size={14}
          aria-hidden
          className={
            isFailure || item.kind === "blocked"
              ? "text-critical-ink"
              : item.kind === "advisory"
                ? "text-info-ink"
                : "text-warning-ink"
          }
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-[1.45] font-semibold text-foreground">{item.title}</p>
        <p className="mt-0.5 max-w-[60ch] text-[12px] leading-[1.5] text-muted-foreground">
          {item.why}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Chip tone="neutral">
          <Id className="text-[11px]">{appCode}</Id>
        </Chip>
        <Button
          variant={isFailure ? "default" : "outline"}
          size="xs"
          render={<Link to={target} params={{ appId }} />}
        >
          {actionLabel}
          <IconArrowNarrowRight size={12} aria-hidden />
        </Button>
      </div>
    </li>
  );
}

function AppCard({
  app,
  verdict,
}: {
  app: Application;
  verdict: ReturnType<typeof deriveVerdict>;
}) {
  return (
    <Link
      to="/prototype/$appId/overview"
      params={{ appId: app.id }}
      className={cn(
        "group relative flex min-h-[104px] flex-col rounded-[4px] border border-border bg-card p-4 transition-colors",
        "hover:border-border-strong pop-hover",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <span className="flex items-center gap-2">
        <StatusDot state={verdict.environments[0]?.state ?? "unknown"} />
        <Id className="text-muted-foreground">{app.code}</Id>
      </span>
      <span className="mt-1.5 block text-[15px] font-bold tracking-[-0.01em] text-foreground">
        {app.name}
      </span>
      <span className="mt-0.5 block text-[12px] leading-[1.5] text-muted-foreground">
        {verdict.headline}
      </span>
      <span className="mt-auto flex items-center gap-1 pt-3 text-[12px] font-semibold text-brand-ink">
        Open workbench
        <IconArrowNarrowRight
          size={13}
          aria-hidden
          className="transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}

function PlatformNotices() {
  const notices = APPLICATIONS.flatMap((app) => app.advisories)
    .filter((advisory) => advisory.severity === "attention")
    .slice(0, 2);

  if (notices.length === 0) return null;

  return (
    <div className="rounded-[4px] border border-border bg-card px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Platform notices
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {notices.map((notice) => (
          <li key={notice.id} className="text-[12px] leading-[1.5]">
            <span className="font-medium text-foreground">{notice.label}</span>
            <span className="block text-muted-foreground">{notice.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
