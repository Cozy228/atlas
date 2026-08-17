/**
 * Prototype `opus` — Dashboard (Workbench)
 * ========================================
 * The surface a developer lands on. It answers three questions in order:
 * 1. What needs attention right now? (ranked attention list)
 * 2. Where am I in the journey? (progress + the single blocking step)
 * 3. What is the context I am working in? (fact ledger with provenance)
 *
 * Recent runs sit underneath as an addressable history, not a feed.
 */
import { Link } from "@tanstack/react-router";
import {
  IconAlertTriangle,
  IconArrowNarrowRight,
  IconClockPause,
  IconLockExclamation,
  IconShieldCheck,
} from "@tabler/icons-react";

import { useApplication } from "@/routes/prototype/opus";
import { ago, elapsed } from "./fixtures/clock";
import { attentionItems, journeySummary, stepsByPhase } from "./fixtures/derive";
import { systemLabel } from "./fixtures/systems";
import type { AttentionItem, Run } from "./fixtures/types";
import { FactRow, HolderChip, Id, PageHeader, Panel, StateChip, Well } from "./ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ATTENTION_ICON = {
  failure: IconAlertTriangle,
  blocked: IconLockExclamation,
  waiting: IconClockPause,
  advisory: IconShieldCheck,
  "data-quality": IconAlertTriangle,
} as const;

const ATTENTION_TONE = {
  failure: "text-[var(--critical-ink)]",
  blocked: "text-[var(--critical-ink)]",
  waiting: "text-[var(--warning-ink)]",
  advisory: "text-[var(--info-ink)]",
  "data-quality": "text-muted-foreground",
} as const;

export function DashboardPage() {
  const app = useApplication();
  const summary = journeySummary(app);
  const attention = attentionItems(app);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-6">
      <PageHeader
        title={`${app.name}`}
        lead={
          <>
            <Id>{app.code}</Id> · {app.team} · {app.workloadPattern} ·{" "}
            {app.lifecycle === "onboarding" ? "onboarding to DEV" : "operating in DEV"}
          </>
        }
        aside={
          <Link to="/prototype/opus/onboarding" search={{ app: app.id }}>
            <Button variant="outline" size="sm">
              View journey
              <IconArrowNarrowRight size={14} aria-hidden />
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* Left: attention + journey */}
        <div className="flex min-w-0 flex-col gap-6">
          <AttentionList items={attention} appId={app.id} />
          <JourneySummary summary={summary} appId={app.id} />
        </div>

        {/* Right: context + runs */}
        <div className="flex min-w-0 flex-col gap-6">
          <ContextLedger />
          <RecentRuns />
        </div>
      </div>
    </div>
  );
}

function AttentionList({ items, appId }: { items: ReadonlyArray<AttentionItem>; appId: string }) {
  if (items.length === 0) {
    return (
      <Panel title="What needs attention" note="Nothing is blocking you right now.">
        <p className="px-3.5 py-6 text-[13px] text-muted-foreground">
          Every step is verified or not started. Atlas will surface the next item here the moment
          something changes.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="What needs attention"
      note="Ranked by urgency. The first item is the one thing stopping you."
    >
      <ol className="flex flex-col">
        {items.map((item, index) => {
          const Icon = ATTENTION_ICON[item.kind];
          const isFirst = index === 0;
          return (
            <li
              key={item.id}
              className={cn(
                "flex flex-col gap-2 border-b border-[var(--proto-hairline)] px-3.5 py-3 last:border-b-0",
                isFirst && "bg-[var(--proto-tint-stop)]/40",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "mt-0.5 grid size-5 shrink-0 place-items-center rounded-[3px]",
                    isFirst ? "bg-[var(--proto-tint-stop)]" : "bg-[var(--proto-mark-bg)]",
                  )}
                >
                  <Icon size={13} aria-hidden className={ATTENTION_TONE[item.kind]} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-[13px] font-semibold leading-[1.4] text-foreground">
                    {item.title}
                  </p>
                  <p className="max-w-[58ch] text-[12.5px] leading-[1.5] text-muted-foreground">
                    {item.why}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <HolderChip holder={item.holder} />
                    {item.since ? (
                      <span className="proto-num text-[11px] text-muted-foreground">
                        since {ago(item.since)}
                      </span>
                    ) : null}
                  </div>
                </div>
                {item.action ? <AttentionAction action={item.action} appId={appId} /> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function AttentionAction({ action, appId }: { action: AttentionItem["action"]; appId: string }) {
  if (action === undefined) return null;

  switch (action.kind) {
    case "diagnose":
      return (
        <Link to="/prototype/opus/diagnosis" search={{ app: appId, run: action.runId }}>
          <Button variant="outline" size="xs" className="shrink-0">
            Diagnose
            <IconArrowNarrowRight size={12} aria-hidden />
          </Button>
        </Link>
      );
    case "request":
      return (
        <Link to="/prototype/opus/scaffolder" search={{ app: appId, intent: action.intentId }}>
          <Button size="xs" className="shrink-0">
            Prepare
            <IconArrowNarrowRight size={12} aria-hidden />
          </Button>
        </Link>
      );
    case "external":
      return (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          in {systemLabel(action.systemId)}
        </span>
      );
    case "wait":
      return (
        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
          {action.label}
        </span>
      );
    case "confirm":
      return null;
  }
}

function JourneySummary({
  summary,
  appId,
}: {
  summary: ReturnType<typeof journeySummary>;
  appId: string;
}) {
  const app = useApplication();
  const phases = stepsByPhase(app);

  return (
    <Panel
      title="Journey progress"
      note={`${app.journey.goldenPathLabel} · v${app.journey.version}`}
      actions={
        <Link to="/prototype/opus/onboarding" search={{ app: appId }}>
          <Button variant="ghost" size="xs">
            Open
            <IconArrowNarrowRight size={12} aria-hidden />
          </Button>
        </Link>
      }
    >
      <div className="px-3.5 py-3">
        <div className="flex items-baseline gap-3">
          <span className="proto-num text-[22px] font-semibold text-foreground">
            {summary.complete}
            <span className="text-[14px] font-normal text-muted-foreground">
              {" "}
              / {summary.applicable}
            </span>
          </span>
          <span className="text-[12px] text-muted-foreground">steps complete</span>
          {summary.waived > 0 ? (
            <span className="text-[12px] text-muted-foreground">
              · {summary.waived} waived under exception
            </span>
          ) : null}
        </div>

        {/* Phase rail: a compact progress strip, not a percentage bar. */}
        <div className="mt-3 flex items-center gap-1">
          {phases.map((entry) => {
            const allDone = entry.steps.every(
              (s) =>
                s.state === "verified" ||
                s.state === "confirmed" ||
                s.state === "waived" ||
                s.state === "off-branch",
            );
            const hasBlocker = entry.steps.some(
              (s) => s.state === "failed" || s.state === "blocked" || s.state === "waiting",
            );
            const isCurrent = entry.phase.id === summary.currentPhaseId;
            return (
              <div
                key={entry.phase.id}
                className="flex min-w-0 flex-1 flex-col gap-1"
                title={entry.phase.label}
              >
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-colors",
                    hasBlocker
                      ? "bg-[var(--critical)]/60"
                      : allDone
                        ? "bg-[var(--success)]/50"
                        : isCurrent
                          ? "bg-brand"
                          : "bg-[var(--proto-mark-bg)]",
                  )}
                />
                <span
                  className={cn(
                    "truncate text-[10px] font-medium",
                    isCurrent ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {entry.phase.label}
                </span>
              </div>
            );
          })}
        </div>

        {summary.blockingStep ? (
          <Well className="mt-3 border-[var(--critical)]/30 bg-[var(--proto-tint-stop)]/50">
            <div className="flex items-start gap-2.5">
              <StateChip state={summary.blockingStep.state} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-[13px] font-semibold text-foreground">
                  {summary.blockingStep.title}
                </p>
                <p className="text-[12px] leading-[1.45] text-muted-foreground">
                  {summary.blockingStep.intent}
                </p>
                <HolderChip holder={summary.blockingStep.holder} className="mt-1" />
              </div>
            </div>
          </Well>
        ) : (
          <Well className="mt-3 border-[var(--success)]/30 bg-[var(--proto-tint-ok)]/50">
            <p className="flex items-center gap-2 text-[13px] font-medium text-[var(--success-ink)]">
              <IconShieldCheck size={15} aria-hidden />
              Nothing is blocking the journey.
            </p>
          </Well>
        )}
      </div>
    </Panel>
  );
}

function ContextLedger() {
  const app = useApplication();
  const keyFacts = app.context.slice(0, 8);

  return (
    <Panel
      title="Application context"
      note="What Atlas has resolved. Every value carries its provenance."
    >
      <dl className="flex flex-col">
        {keyFacts.map((fact) => (
          <FactRow key={fact.id} fact={fact} />
        ))}
      </dl>
    </Panel>
  );
}

function RecentRuns() {
  const app = useApplication();
  const runs = [...app.runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));

  return (
    <Panel
      title="Recent runs"
      note="Addressable history. Each run links to its diagnosis when one exists."
    >
      <ul className="flex flex-col">
        {runs.map((run) => (
          <RunRow key={run.id} run={run} appId={app.id} />
        ))}
      </ul>
    </Panel>
  );
}

function RunRow({ run, appId }: { run: Run; appId: string }) {
  const resultTone =
    run.result === "failed"
      ? "text-[var(--critical-ink)]"
      : run.result === "succeeded"
        ? "text-[var(--success-ink)]"
        : run.result === "running"
          ? "text-brand-ink"
          : "text-[var(--warning-ink)]";

  return (
    <li className="flex items-baseline gap-2 border-b border-[var(--proto-hairline)] px-3.5 py-2.5 last:border-b-0">
      <span className={cn("text-[12px] font-semibold capitalize", resultTone)}>{run.result}</span>
      <span className="min-w-0 flex-1">
        <span className="text-[13px] font-medium text-foreground">{run.label}</span>
        <span className="block text-[11px] text-muted-foreground">
          <Id>{run.id}</Id> · {systemLabel(run.systemId)} · {run.environment}
        </span>
      </span>
      <span className="proto-num shrink-0 text-[11px] text-muted-foreground">
        {elapsed(run.startedAt)} ago
      </span>
      {run.diagnosisId ? (
        <Link to="/prototype/opus/diagnosis" search={{ app: appId, run: run.id }}>
          <Button variant="ghost" size="xs" className="shrink-0">
            Diagnosis
          </Button>
        </Link>
      ) : null}
    </li>
  );
}
