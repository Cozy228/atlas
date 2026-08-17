/**
 * Prototype `opus` — Onboarding (Journey)
 * =======================================
 * A stateful journey rendered as a phase-ordered step list. Each step is a
 * collapsible row carrying its state, holder, intent, and — when opened — its
 * facts, evidence, blockers, decisions, exceptions and fallback.
 *
 * The blocking step opens by default. Off-branch and waived steps are shown but
 * de-emphasised, because "not on this branch" and "deliberately skipped" are
 * real states that earn their own visual word, not error states.
 */
import { Link } from "@tanstack/react-router";
import { IconArrowNarrowRight, IconChevronDown, IconCornerDownRight } from "@tabler/icons-react";

import { useApplication } from "@/routes/prototype/opus";
import { ago, stamp } from "./fixtures/clock";
import { journeySummary, stepsByPhase } from "./fixtures/derive";
import { systemLabel } from "./fixtures/systems";
import type { JourneyStep } from "./fixtures/types";
import { EvidenceRow, FactRow, HolderChip, Id, PageHeader, Panel, StateChip, Well } from "./ui";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function OnboardingPage() {
  const app = useApplication();
  const summary = journeySummary(app);
  const phases = stepsByPhase(app);
  const blockingId = summary.blockingStep?.id;

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-6">
      <PageHeader
        title="Onboarding journey"
        lead={
          <>
            {app.journey.goldenPathLabel} · v{app.journey.version} · owner {app.journey.owner} ·
            started {ago(app.journey.startedAt)}
          </>
        }
        aside={
          <div className="flex flex-col items-end gap-1">
            <span className="proto-num text-[20px] font-semibold text-foreground">
              {summary.complete}
              <span className="text-[13px] font-normal text-muted-foreground">
                {" "}
                / {summary.applicable}
              </span>
            </span>
            <span className="text-[11px] text-muted-foreground">steps complete</span>
          </div>
        }
      />

      {summary.blockingStep ? <BlockingCallout step={summary.blockingStep} appId={app.id} /> : null}

      {phases.map((entry) => {
        const isCurrent = entry.phase.id === summary.currentPhaseId;
        return (
          <section key={entry.phase.id} className="flex flex-col gap-0">
            <div className="flex items-baseline gap-3 px-1">
              <span
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.08em]",
                  isCurrent ? "text-brand-ink" : "text-muted-foreground",
                )}
              >
                {entry.phase.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
                {entry.phase.outcome}
              </span>
            </div>
            <div className="mt-2 flex flex-col gap-0 rounded-lg border border-border bg-card">
              {entry.steps.map((step, index) => (
                <StepRow
                  key={step.id}
                  step={step}
                  appId={app.id}
                  defaultOpen={step.id === blockingId}
                  isLast={index === entry.steps.length - 1}
                />
              ))}
            </div>
          </section>
        );
      })}

      <CompletionCriteria />
    </div>
  );
}

function BlockingCallout({ step, appId }: { step: JourneyStep; appId: string }) {
  return (
    <Well className="border-[var(--critical)]/30 bg-[var(--proto-tint-stop)]/40">
      <div className="flex flex-wrap items-start gap-3">
        <StateChip state={step.state} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[14px] font-semibold text-foreground">{step.title}</p>
          <p className="max-w-[62ch] text-[13px] leading-[1.5] text-muted-foreground">
            {step.intent}
          </p>
          <HolderChip holder={step.holder} className="mt-0.5" />
          {step.blockers?.[0] ? (
            <p className="mt-1 flex items-start gap-1.5 text-[12.5px] leading-[1.5] text-[var(--critical-ink)]">
              <IconCornerDownRight size={14} aria-hidden className="mt-0.5 shrink-0" />
              {step.blockers[0].summary}
            </p>
          ) : null}
        </div>
        {step.nextAction ? <NextActionLink action={step.nextAction} appId={appId} /> : null}
      </div>
    </Well>
  );
}

function StepRow({
  step,
  appId,
  defaultOpen,
  isLast,
}: {
  step: JourneyStep;
  appId: string;
  defaultOpen: boolean;
  isLast: boolean;
}) {
  const isOffBranch = step.state === "off-branch";
  const isWaived = step.state === "waived";
  const isDeemphasised = isOffBranch || isWaived;
  const isBlocking =
    step.state === "failed" || step.state === "blocked" || step.state === "waiting";
  const hasDetail =
    (step.facts !== undefined && step.facts.length > 0) ||
    (step.evidence !== undefined && step.evidence.length > 0) ||
    step.blockers !== undefined ||
    step.decision !== undefined ||
    step.exception !== undefined ||
    step.fallback !== undefined;

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn(
        "min-w-0",
        !isLast && "border-b border-[var(--proto-hairline)]",
        isBlocking && "bg-[var(--proto-tint-stop)]/30",
        isDeemphasised && "opacity-60",
      )}
    >
      <CollapsibleTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors",
              "hover:bg-[var(--proto-chrome)]/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              !hasDetail && "cursor-default",
            )}
          >
            <StateChip state={step.state} className="mt-0.5" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-[13px] font-semibold leading-[1.4] text-foreground">
                {step.title}
              </p>
              <p className="max-w-[62ch] text-[12px] leading-[1.45] text-muted-foreground">
                {step.intent}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <HolderChip holder={step.holder} />
                <span className="text-[11px] text-muted-foreground">
                  executed by {systemLabel(step.executedBy)}
                </span>
              </div>
            </div>
            {hasDetail ? <CollapsibleChevron /> : null}
          </button>
        }
      />
      {hasDetail ? (
        <CollapsibleContent className="proto-settle">
          <StepDetail step={step} appId={appId} />
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  );
}

function CollapsibleChevron() {
  return (
    <span className="ml-auto shrink-0 pt-0.5">
      <IconChevronDown
        size={15}
        aria-hidden
        className="text-muted-foreground transition-transform [[data-open]_&]:rotate-180"
      />
    </span>
  );
}

function StepDetail({ step, appId }: { step: JourneyStep; appId: string }) {
  return (
    <div className="flex flex-col gap-4 border-t border-[var(--proto-hairline)] px-3.5 py-3.5">
      {/* Delegation boundary */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Delegation
        </p>
        <p className="text-[12.5px] leading-[1.5] text-muted-foreground">
          <span className="font-medium text-foreground">Atlas:</span> {step.atlasRole}
        </p>
        <p className="text-[12.5px] leading-[1.5] text-muted-foreground">
          <span className="font-medium text-foreground">Executes in:</span>{" "}
          {systemLabel(step.executedBy)}
        </p>
      </div>

      {/* Decision */}
      {step.decision ? <DecisionDetail decision={step.decision} /> : null}

      {/* Exception */}
      {step.exception ? (
        <Well className="border-dashed border-[var(--proto-void)] bg-transparent">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--proto-void-ink)]">
            Exception
          </p>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-foreground">
            {step.exception.reason}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Reference <Id>{step.exception.reference}</Id> · approved by {step.exception.approvedBy}{" "}
            · expires {stamp(step.exception.expiresAt)}
          </p>
        </Well>
      ) : null}

      {/* Facts */}
      {step.facts && step.facts.length > 0 ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Facts
          </p>
          <dl className="rounded-md border border-border">
            {step.facts.map((fact) => (
              <FactRow key={fact.id} fact={fact} />
            ))}
          </dl>
        </div>
      ) : null}

      {/* Evidence */}
      {step.evidence && step.evidence.length > 0 ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Evidence
          </p>
          <ul className="rounded-md border border-border px-3.5 py-1">
            {step.evidence.map((ev) => (
              <EvidenceRow key={ev.id} evidence={ev} />
            ))}
          </ul>
        </div>
      ) : null}

      {/* Blockers */}
      {step.blockers && step.blockers.length > 0 ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Blockers
          </p>
          <ul className="flex flex-col gap-2">
            {step.blockers.map((blocker) => (
              <li key={blocker.id}>
                <Well className="border-[var(--critical)]/25 bg-[var(--proto-tint-stop)]/30">
                  <p className="text-[12.5px] leading-[1.5] text-foreground">{blocker.summary}</p>
                  <HolderChip holder={blocker.holder} className="mt-1" />
                </Well>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Fallback */}
      {step.fallback ? (
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            If the normal path fails
          </p>
          <p className="text-[12.5px] leading-[1.5] text-muted-foreground">{step.fallback}</p>
        </div>
      ) : null}

      {/* Off-branch reason */}
      {step.offBranchReason ? (
        <p className="text-[12px] italic leading-[1.45] text-muted-foreground">
          {step.offBranchReason}
        </p>
      ) : null}

      {/* Next action */}
      {step.nextAction ? (
        <div className="flex items-center gap-2">
          <NextActionLink action={step.nextAction} appId={appId} />
        </div>
      ) : null}
    </div>
  );
}

function DecisionDetail({ decision }: { decision: NonNullable<JourneyStep["decision"]> }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        Decision
      </p>
      <p className="text-[13px] font-medium text-foreground">{decision.question}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {decision.options.map((option) => {
          const chosen = option.id === decision.chosenOptionId;
          return (
            <li
              key={option.id}
              className={cn(
                "flex items-start gap-2 rounded-md border px-2.5 py-2",
                chosen ? "border-brand/40 bg-brand-tint" : "border-border bg-transparent",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 size-3.5 shrink-0 rounded-full border",
                  chosen ? "border-brand bg-brand" : "border-border-strong",
                )}
                aria-hidden
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="flex items-center gap-2 text-[12.5px] font-medium text-foreground">
                  {option.label}
                  {option.recommended ? (
                    <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-ink">
                      Recommended
                    </span>
                  ) : null}
                </p>
                <p className="text-[12px] leading-[1.45] text-muted-foreground">{option.detail}</p>
                <p className="text-[11px] italic leading-[1.4] text-muted-foreground">
                  {option.rationale}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Decided by {decision.decidedBy} · {ago(decision.decidedAt)} · determines{" "}
        {decision.determines}
      </p>
    </div>
  );
}

function NextActionLink({
  action,
  appId,
}: {
  action: NonNullable<JourneyStep["nextAction"]>;
  appId: string;
}) {
  switch (action.kind) {
    case "diagnose":
      return (
        <Link to="/prototype/opus/diagnosis" search={{ app: appId, run: action.runId }}>
          <Button size="sm" className="shrink-0">
            {action.label}
            <IconArrowNarrowRight size={14} aria-hidden />
          </Button>
        </Link>
      );
    case "request":
      return (
        <Link to="/prototype/opus/scaffolder" search={{ app: appId, intent: action.intentId }}>
          <Button size="sm" className="shrink-0">
            {action.label}
            <IconArrowNarrowRight size={14} aria-hidden />
          </Button>
        </Link>
      );
    case "external":
      return (
        <span className="text-[12px] text-muted-foreground">
          {action.label} in {systemLabel(action.systemId)}
        </span>
      );
    case "wait":
      return <span className="text-[12px] font-medium text-muted-foreground">{action.label}</span>;
    case "confirm":
      return null;
  }
}

function CompletionCriteria() {
  const app = useApplication();
  const summary = journeySummary(app);

  const met = app.journey.completionCriteria.map((criterion) => {
    // Deterministic mapping: each criterion maps to a step state check.
    if (criterion.includes("owning team")) return summary.byState.verified >= 1;
    if (criterion.includes("Deploy entitlement")) return (summary.byState.verified ?? 0) >= 2;
    if (criterion.includes("Infrastructure applied")) return (summary.byState.verified ?? 0) >= 4;
    if (criterion.includes("revision built"))
      return (
        summary.blockingStep?.id !== "first-dev-deploy" && (summary.byState.verified ?? 0) >= 6
      );
    if (criterion.includes("readiness endpoint")) return (summary.byState.verified ?? 0) >= 8;
    if (criterion.includes("evidence"))
      return summary.blockingStep === undefined && summary.outstanding === 0;
    return false;
  });

  return (
    <Panel title="Completion criteria" note={`From golden path v${app.journey.version}`}>
      <ul className="flex flex-col">
        {app.journey.completionCriteria.map((criterion, index) => {
          const isMet = met[index];
          return (
            <li
              key={index}
              className="flex items-start gap-2.5 border-b border-[var(--proto-hairline)] px-3.5 py-2.5 last:border-b-0"
            >
              <span
                className={cn(
                  "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                  isMet
                    ? "bg-[var(--success)]/20 text-[var(--success-ink)]"
                    : "bg-[var(--proto-mark-bg)] text-muted-foreground",
                )}
                aria-hidden
              >
                {isMet ? "✓" : "·"}
              </span>
              <p
                className={cn(
                  "text-[12.5px] leading-[1.45]",
                  isMet ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {criterion}
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
