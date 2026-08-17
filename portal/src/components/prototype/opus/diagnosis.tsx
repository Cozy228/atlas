/**
 * Prototype `opus` — Diagnosis
 * =============================
 * An evidence-backed explanation of a failed step. The surface enforces a
 * strict separation: the symptom (the observable failure) is never a cause.
 * Causes are ranked candidates with a strength word above the raw confidence,
 * each carrying supporting and contradicting evidence and named unknowns.
 *
 * The negative space is published: what was checked and ruled out, what was
 * not checked and why, and which correlated changes are context vs candidate.
 * Recovery options name their risk, their approval, and whether they are
 * effective while the cause is unresolved.
 */
import { Link, useSearch } from "@tanstack/react-router";
import {
  IconArrowNarrowRight,
  IconCheck,
  IconCornerDownRight,
  IconMinus,
  IconX,
} from "@tabler/icons-react";

import { useApplication } from "@/routes/prototype/opus";
import { ago } from "./fixtures/clock";
import { resolveDiagnosis, runById, stepById } from "./fixtures/derive";
import { systemLabel } from "./fixtures/systems";
import type {
  Cause,
  CorrelatedChange,
  Diagnosis as DiagnosisType,
  RecoveryOption,
} from "./fixtures/types";
import { Confidence, EvidenceRow, Id, PageHeader, Panel, Well } from "./ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DiagnosisPage() {
  const app = useApplication();
  const { run: runId } = useSearch({ from: "/prototype/opus/diagnosis" });
  const diagnosis = resolveDiagnosis(app, runId);

  if (diagnosis === undefined) {
    return <NoDiagnosis appId={app.id} />;
  }

  const run = runById(app, diagnosis.runId);
  const step = stepById(app, diagnosis.stepId);

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6">
      <PageHeader
        title="Diagnosis"
        lead={
          run ? (
            <>
              <Id>{run.id}</Id> · {run.label} · failed {ago(run.startedAt)} ·{" "}
              {step?.title ?? "an unnamed step"}
            </>
          ) : (
            "No run found for this diagnosis."
          )
        }
        aside={
          <Link to="/prototype/opus/onboarding" search={{ app: app.id }}>
            <Button variant="outline" size="sm">
              Back to journey
              <IconArrowNarrowRight size={14} aria-hidden />
            </Button>
          </Link>
        }
      />

      <Symptom diagnosis={diagnosis} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* Left: causes */}
        <div className="flex min-w-0 flex-col gap-6">
          {diagnosis.causes.map((cause, index) => (
            <CauseCard key={cause.id} cause={cause} rank={index + 1} />
          ))}
        </div>

        {/* Right: scope + changes + not-checked */}
        <div className="flex min-w-0 flex-col gap-6">
          <ScopePanel diagnosis={diagnosis} />
          <ChangesPanel changes={diagnosis.changes} />
          <NotCheckedPanel diagnosis={diagnosis} />
        </div>
      </div>

      <RecoverySection diagnosis={diagnosis} appId={app.id} />
    </div>
  );
}

function NoDiagnosis({ appId }: { appId: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6">
      <PageHeader
        title="Diagnosis"
        lead="Atlas correlates the failed run with application, environment, change and evidence context."
      />
      <Panel title="No failure to diagnose">
        <div className="px-3.5 py-8">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--success-ink)]">
            <IconCheck size={18} aria-hidden />
            This application has no open failures.
          </p>
          <p className="mt-2 max-w-[62ch] text-[13px] leading-[1.55] text-muted-foreground">
            When a deployment or infrastructure run fails, Atlas collects the run stages, recent
            platform changes, configuration, and source evidence, then presents ranked causes with
            confidence and a recovery path. Open a failed run from the workbench to see it.
          </p>
          <Link to="/prototype/opus/dashboard" search={{ app: appId }}>
            <Button variant="outline" size="sm" className="mt-3">
              Back to workbench
              <IconArrowNarrowRight size={14} aria-hidden />
            </Button>
          </Link>
        </div>
      </Panel>
    </div>
  );
}

function Symptom({ diagnosis }: { diagnosis: DiagnosisType }) {
  return (
    <Panel title="Symptom" note="The observable failure. This is not a cause.">
      <div className="px-3.5 py-3">
        <p className="text-[14px] font-medium leading-[1.5] text-foreground">{diagnosis.symptom}</p>
        <Well className="mt-3 border-border bg-[var(--proto-inset)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Quoted error
          </p>
          <p className="mt-1 break-words proto-id text-[12px] leading-[1.6] text-foreground">
            {diagnosis.quotedError}
          </p>
        </Well>
      </div>
    </Panel>
  );
}

function CauseCard({ cause, rank }: { cause: Cause; rank: number }) {
  const isTop = rank === 1;
  return (
    <Panel
      title={`Cause ${rank}`}
      note={cause.ownerTeam}
      className={isTop ? "border-l-2 border-l-brand" : undefined}
    >
      <div className="flex flex-col gap-4 px-3.5 py-3.5">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-full text-[12px] font-bold",
              isTop
                ? "bg-brand text-brand-foreground"
                : "bg-[var(--proto-mark-bg)] text-muted-foreground",
            )}
          >
            {rank}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-[14px] font-semibold leading-[1.4] text-foreground">{cause.claim}</p>
            <Confidence value={cause.confidence} label={cause.confidenceLabel} />
          </div>
        </div>

        <p className="max-w-[64ch] text-[12.5px] leading-[1.55] text-muted-foreground">
          {cause.reasoning}
        </p>

        {cause.supporting.length > 0 ? (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--success-ink)]">
              <IconCheck size={12} aria-hidden />
              Supporting evidence
            </p>
            <ul className="rounded-md border border-border px-3.5 py-1">
              {cause.supporting.map((ev, index) => (
                <EvidenceRow key={index} evidence={ev} />
              ))}
            </ul>
          </div>
        ) : null}

        {cause.contradicting.length > 0 ? (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--critical-ink)]">
              <IconX size={12} aria-hidden />
              Contradicting evidence
            </p>
            <ul className="rounded-md border border-border px-3.5 py-1">
              {cause.contradicting.map((ev, index) => (
                <EvidenceRow key={index} evidence={ev} />
              ))}
            </ul>
          </div>
        ) : null}

        {cause.unknowns.length > 0 ? (
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <IconMinus size={12} aria-hidden />
              Unknowns
            </p>
            <ul className="flex flex-col gap-1">
              {cause.unknowns.map((unknown, index) => (
                <li
                  key={index}
                  className="flex items-start gap-1.5 text-[12px] leading-[1.45] text-muted-foreground"
                >
                  <IconCornerDownRight size={13} aria-hidden className="mt-0.5 shrink-0" />
                  {unknown}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function ScopePanel({ diagnosis }: { diagnosis: DiagnosisType }) {
  return (
    <Panel title="Scope of investigation" note="What Atlas gathered to explain this failure.">
      <ul className="flex flex-col">
        {diagnosis.scope.map((item, index) => (
          <li
            key={index}
            className="border-b border-[var(--proto-hairline)] px-3.5 py-2 text-[12.5px] leading-[1.45] text-foreground last:border-b-0"
          >
            {item}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function ChangesPanel({ changes }: { changes: ReadonlyArray<CorrelatedChange> }) {
  if (changes.length === 0) return null;

  const RELATION_LABEL: Record<CorrelatedChange["relation"], string> = {
    candidate: "Candidate",
    context: "Context",
    "ruled-out": "Ruled out",
  };

  const RELATION_TONE: Record<CorrelatedChange["relation"], string> = {
    candidate: "border-[var(--warning)]/45 text-[var(--warning-ink)]",
    context: "border-border text-muted-foreground",
    "ruled-out": "border-[var(--success)]/40 text-[var(--success-ink)]",
  };

  return (
    <Panel
      title="Correlated changes"
      note="Platform changes near the failure, with Atlas' read of the relationship."
    >
      <ul className="flex flex-col">
        {changes.map((change) => (
          <li
            key={change.id}
            className="flex flex-col gap-1 border-b border-[var(--proto-hairline)] px-3.5 py-2.5 last:border-b-0"
          >
            <div className="flex items-baseline gap-2">
              <span className="min-w-0 flex-1 text-[13px] font-medium text-foreground">
                {change.label}
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-[3px] border px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.04em]",
                  RELATION_TONE[change.relation],
                )}
              >
                {RELATION_LABEL[change.relation]}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              <Id>{change.id}</Id> · {systemLabel(change.systemId)} · {ago(change.at)}
            </p>
            <p className="max-w-[52ch] text-[11.5px] leading-[1.45] text-muted-foreground">
              {change.note}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function NotCheckedPanel({ diagnosis }: { diagnosis: DiagnosisType }) {
  if (diagnosis.notChecked.length === 0) return null;

  return (
    <Panel title="Not checked" note="Atlas is honest about what it could not verify.">
      <ul className="flex flex-col">
        {diagnosis.notChecked.map((item, index) => (
          <li
            key={index}
            className="border-b border-[var(--proto-hairline)] px-3.5 py-2.5 last:border-b-0"
          >
            <p className="text-[12.5px] font-medium text-foreground">{item.label}</p>
            <p className="mt-0.5 text-[11.5px] leading-[1.45] text-muted-foreground">
              {item.reason}
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function RecoverySection({ diagnosis, appId }: { diagnosis: DiagnosisType; appId: string }) {
  return (
    <Panel
      title="Recovery options"
      note="Each option names its risk, its approval, and whether it works while the cause is unresolved."
    >
      <ul className="flex flex-col">
        {diagnosis.recovery.map((option) => (
          <RecoveryRow key={option.id} option={option} appId={appId} />
        ))}
      </ul>
    </Panel>
  );
}

function RecoveryRow({ option, appId }: { option: RecoveryOption; appId: string }) {
  const RISK_TONE = {
    none: "text-[var(--success-ink)]",
    low: "text-muted-foreground",
    medium: "text-[var(--warning-ink)]",
  } as const;

  return (
    <li
      className={cn(
        "flex flex-col gap-2 border-b border-[var(--proto-hairline)] px-3.5 py-3.5 last:border-b-0",
        option.recommended && "bg-brand-tint/40",
      )}
    >
      <div className="flex items-start gap-2.5">
        {option.recommended ? (
          <span className="mt-0.5 shrink-0 rounded-[3px] bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-brand-foreground">
            Recommended
          </span>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[13px] font-semibold text-foreground">{option.label}</p>
          <p className="max-w-[62ch] text-[12.5px] leading-[1.5] text-muted-foreground">
            {option.summary}
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-0.5 pl-1">
        {option.effect.map((effect, index) => (
          <li
            key={index}
            className="flex items-start gap-1.5 text-[12px] leading-[1.45] text-muted-foreground"
          >
            <IconCornerDownRight size={13} aria-hidden className="mt-0.5 shrink-0" />
            {effect}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-1">
        <span className="text-[11px] text-muted-foreground">
          Executed by{" "}
          <span className="font-medium text-foreground">{systemLabel(option.executedBy)}</span>
        </span>
        <span className={cn("text-[11px] font-medium", RISK_TONE[option.risk])}>
          Risk: {option.risk}
        </span>
        {option.needsApprovalFrom ? (
          <span className="text-[11px] text-[var(--warning-ink)]">
            Needs approval from {option.needsApprovalFrom}
          </span>
        ) : null}
      </div>

      {option.ineffectiveWhile ? (
        <p className="flex items-start gap-1.5 pl-1 text-[11.5px] italic leading-[1.45] text-[var(--critical-ink)]">
          <IconX size={13} aria-hidden className="mt-0.5 shrink-0" />
          Ineffective while: {option.ineffectiveWhile}
        </p>
      ) : null}

      {option.action ? (
        <div className="pl-1">
          <RecoveryAction action={option.action} appId={appId} />
        </div>
      ) : null}
    </li>
  );
}

function RecoveryAction({ action, appId }: { action: RecoveryOption["action"]; appId: string }) {
  if (action === undefined) return null;

  switch (action.kind) {
    case "request":
      return (
        <Link to="/prototype/opus/scaffolder" search={{ app: appId, intent: action.intentId }}>
          <Button size="sm">
            {action.label}
            <IconArrowNarrowRight size={14} aria-hidden />
          </Button>
        </Link>
      );
    case "diagnose":
      return (
        <Link to="/prototype/opus/diagnosis" search={{ app: appId, run: action.runId }}>
          <Button variant="outline" size="sm">
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
    case "confirm":
      return null;
  }
}
