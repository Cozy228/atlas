/**
 * Prototype `opus` — Scaffolder (Request)
 * =======================================
 * Express an intent; Atlas resolves everything it can from context, policy and
 * defaults, then shows you exactly what it resolved, from which source, what it
 * recommends and why, and what still needs a human decision.
 *
 * The review-before-execute section is mandatory: nothing is sent until you
 * confirm. The simulation is deterministic fixture content, not a real backend.
 */
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  IconArrowNarrowRight,
  IconCheck,
  IconLockExclamation,
  IconSend,
} from "@tabler/icons-react";

import { useApplication } from "@/routes/prototype/opus";
import { systemLabel } from "./fixtures/systems";
import type { ActionIntent, ResolutionField, ResolutionClass } from "./fixtures/types";
import { EvidenceRow, Handoff, Id, PageHeader, Panel, ProvenanceMark, Well } from "./ui";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CLASS_LABEL: Readonly<Record<ResolutionClass, string>> = {
  resolved: "Resolved",
  recommended: "Recommended",
  decision: "Your decision",
  blocked: "Blocked",
};

const CLASS_TONE: Readonly<Record<ResolutionClass, string>> = {
  resolved: "border-[var(--success)]/40 bg-transparent text-[var(--success-ink)]",
  recommended: "border-brand/40 bg-transparent text-brand-ink",
  decision: "border-[var(--warning)]/50 bg-[var(--proto-tint-wait)] text-[var(--warning-ink)]",
  blocked: "border-[var(--critical)]/45 bg-[var(--proto-tint-stop)] text-[var(--critical-ink)]",
};

export function ScaffolderPage() {
  const app = useApplication();
  const { intent: intentId } = useSearch({ from: "/prototype/opus/scaffolder" });
  const navigate = useNavigate();

  const selectedIntent = useMemo(() => {
    if (intentId === undefined) return app.intents[0];
    return app.intents.find((i) => i.id === intentId) ?? app.intents[0];
  }, [app.intents, intentId]);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-6">
      <PageHeader
        title="Request a governed action"
        lead="Atlas resolves what it can from your application context. You decide only what it cannot."
      />

      <IntentPicker
        intents={app.intents}
        selectedId={selectedIntent.id}
        onSelect={(id) =>
          navigate({
            to: "/prototype/opus/scaffolder",
            search: { app: app.id, intent: id },
          })
        }
      />

      <IntentDetail intent={selectedIntent} appId={app.id} />
    </div>
  );
}

function IntentPicker({
  intents,
  selectedId,
  onSelect,
}: {
  intents: ReadonlyArray<ActionIntent>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {intents.map((intent) => {
        const selected = intent.id === selectedId;
        const blocked = intent.blockedBy !== undefined;
        return (
          <button
            key={intent.id}
            type="button"
            onClick={() => onSelect(intent.id)}
            className={cn(
              "flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors",
              selected
                ? "border-brand bg-brand-tint"
                : "border-border bg-card hover:border-border-strong",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "text-[13px] font-semibold",
                  selected ? "text-foreground" : "text-foreground",
                )}
              >
                {intent.label}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">{intent.intent}</span>
            </span>
            {blocked ? (
              <IconLockExclamation
                size={14}
                aria-hidden
                className="shrink-0 text-[var(--critical-ink)]"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function IntentDetail({ intent, appId }: { intent: ActionIntent; appId: string }) {
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Reset simulation when the intent changes.
  const intentKey = intent.id;
  const [activeIntentKey, setActiveIntentKey] = useState(intentKey);
  if (activeIntentKey !== intentKey) {
    setActiveIntentKey(intentKey);
    setSubmitted(false);
    setDecisions({});
  }

  const decisionFields = intent.fields.filter((f) => f.resolutionClass === "decision");
  const unmadeDecisions = decisionFields.filter((f) => decisions[f.id] === undefined);
  const canSubmit = intent.blockedBy === undefined && unmadeDecisions.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Intent statement */}
      <Panel
        title="Your intent"
        note={`Risk level ${intent.riskLevel} · executed by ${systemLabel(intent.executedBy)}`}
      >
        <div className="px-3.5 py-3">
          <p className="text-[14px] font-medium text-foreground">{intent.intent}</p>
          <p className="mt-1 text-[12.5px] leading-[1.5] text-muted-foreground">
            {intent.operation}
          </p>
        </div>
      </Panel>

      {/* Blocked banner */}
      {intent.blockedBy ? (
        <Well className="border-[var(--critical)]/30 bg-[var(--proto-tint-stop)]/40">
          <div className="flex items-start gap-2.5">
            <IconLockExclamation
              size={18}
              aria-hidden
              className="mt-0.5 shrink-0 text-[var(--critical-ink)]"
            />
            <div className="flex min-w-0 flex-col gap-1">
              <p className="text-[13px] font-semibold text-foreground">This request is blocked</p>
              <p className="max-w-[62ch] text-[12.5px] leading-[1.5] text-muted-foreground">
                {intent.blockedBy.summary}
              </p>
              <p className="text-[11px] text-muted-foreground">Held by {intent.blockedBy.owner}</p>
              {intent.blockedBy.diagnosisId ? (
                <Link
                  to="/prototype/opus/diagnosis"
                  search={{ app: appId, run: intent.blockedBy.diagnosisId }}
                >
                  <Button variant="outline" size="xs" className="mt-1">
                    See the diagnosis
                    <IconArrowNarrowRight size={12} aria-hidden />
                  </Button>
                </Link>
              ) : null}
            </div>
          </div>
        </Well>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        {/* Left: resolution table */}
        <div className="flex min-w-0 flex-col gap-6">
          <ResolutionTable
            fields={intent.fields}
            decisions={decisions}
            onDecide={(fieldId, value) => setDecisions((prev) => ({ ...prev, [fieldId]: value }))}
          />
        </div>

        {/* Right: review + delegation */}
        <div className="flex min-w-0 flex-col gap-6">
          <ReviewSummary intent={intent} decisions={decisions} />
          <Handoff
            prepares="Atlas validates the payload against policy, submits it, and records the result."
            executedBy={intent.executedBy}
            observes={intent.observes}
          />
          {intent.approval ? (
            <Well className="border-[var(--warning)]/30 bg-[var(--proto-tint-wait)]/50">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--warning-ink)]">
                Approval required
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.5] text-foreground">
                {intent.approval.why}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Decided by {intent.approval.by}
              </p>
            </Well>
          ) : null}
        </div>
      </div>

      {/* Submit + simulation */}
      {intent.blockedBy === undefined ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button size="lg" disabled={!canSubmit || submitted} onClick={() => setSubmitted(true)}>
              <IconSend size={15} aria-hidden />
              {submitted ? "Submitted" : `Submit to ${systemLabel(intent.executedBy)}`}
            </Button>
            {unmadeDecisions.length > 0 ? (
              <span className="text-[12px] text-muted-foreground">
                {unmadeDecisions.length} decision{unmadeDecisions.length > 1 ? "s" : ""} needed
                before you can submit.
              </span>
            ) : null}
          </div>

          {submitted ? <Simulation intent={intent} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ResolutionTable({
  fields,
  decisions,
  onDecide,
}: {
  fields: ReadonlyArray<ResolutionField>;
  decisions: Record<string, string>;
  onDecide: (fieldId: string, value: string) => void;
}) {
  const resolved = fields.filter((f) => f.resolutionClass === "resolved").length;
  const recommended = fields.filter((f) => f.resolutionClass === "recommended").length;
  const decisions_count = fields.filter((f) => f.resolutionClass === "decision").length;
  const blocked = fields.filter((f) => f.resolutionClass === "blocked").length;

  return (
    <Panel
      title="What Atlas resolved"
      note={`${resolved} resolved · ${recommended} recommended · ${decisions_count} need your decision${blocked > 0 ? ` · ${blocked} blocked` : ""}`}
    >
      <dl className="flex flex-col">
        {fields.map((field) => (
          <ResolutionRow
            key={field.id}
            field={field}
            chosenValue={decisions[field.id]}
            onDecide={onDecide}
          />
        ))}
      </dl>
    </Panel>
  );
}

function ResolutionRow({
  field,
  chosenValue,
  onDecide,
}: {
  field: ResolutionField;
  chosenValue: string | undefined;
  onDecide: (fieldId: string, value: string) => void;
}) {
  const displayValue = chosenValue ?? field.value;

  return (
    <div className="flex flex-col gap-1.5 border-b border-[var(--proto-hairline)] px-3.5 py-3 last:border-b-0">
      <div className="flex items-start gap-2">
        <ProvenanceMark provenance={field.provenance} className="mt-0.5" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-medium text-muted-foreground">{field.label}</span>
            <span
              className={cn(
                "rounded-[3px] border px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.04em]",
                CLASS_TONE[field.resolutionClass],
              )}
            >
              {CLASS_LABEL[field.resolutionClass]}
            </span>
          </div>
          <p
            className={cn(
              "break-words text-[13px] font-medium",
              field.provenance === "unknown" ? "text-[var(--proto-void-ink)]" : "text-foreground",
              field.mono === true ? "proto-id" : undefined,
            )}
          >
            {displayValue}
          </p>
          <p className="max-w-[58ch] text-[11.5px] leading-[1.45] text-muted-foreground">
            {field.reason}
          </p>
          {field.conflict ? (
            <ul className="mt-1 flex flex-col gap-0.5">
              {field.conflict.map((source, index) => (
                <li
                  key={index}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground"
                >
                  <span className="rounded-[2px] bg-[var(--proto-mark-bg)] px-1 py-px font-medium">
                    {systemLabel(source.systemId)}
                  </span>
                  <Id>{source.claim}</Id>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* Decision control */}
      {field.options && field.resolutionClass === "decision" ? (
        <div className="ml-6">
          <Select
            value={chosenValue ?? ""}
            onValueChange={(value) => {
              if (value !== null) onDecide(field.id, value);
            }}
          >
            <SelectTrigger className="h-8 w-full max-w-[20rem]">
              <SelectValue placeholder={`Choose ${field.label.toLowerCase()}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-[11px] text-muted-foreground">{option.detail}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Recommended override */}
      {field.options && field.resolutionClass === "recommended" ? (
        <details className="ml-6">
          <summary className="cursor-pointer text-[11px] font-medium text-brand-ink hover:underline">
            Override the recommendation
          </summary>
          <div className="mt-1.5">
            <Select
              value={chosenValue ?? ""}
              onValueChange={(value) => {
                if (value !== null) onDecide(field.id, value);
              }}
            >
              <SelectTrigger className="h-8 w-full max-w-[20rem]">
                <SelectValue placeholder={`Keep ${field.value}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{option.label}</span>
                      {option.recommended ? (
                        <span className="text-[10px] font-semibold uppercase text-brand-ink">
                          Recommended
                        </span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </details>
      ) : null}
    </div>
  );
}

function ReviewSummary({
  intent,
  decisions,
}: {
  intent: ActionIntent;
  decisions: Record<string, string>;
}) {
  const payloadFields = intent.fields.map((field) => {
    const chosen = decisions[field.id];
    const value = chosen
      ? (field.options?.find((o) => o.id === chosen)?.label ?? chosen)
      : field.value;
    return { key: field.payloadKey, value };
  });

  return (
    <Panel
      title="What will be sent"
      note="Review before you submit. Nothing leaves Atlas until you do."
    >
      <dl className="flex flex-col">
        {payloadFields.map((field) => (
          <div
            key={field.key}
            className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-baseline gap-x-3 border-b border-[var(--proto-hairline)] px-3.5 py-2 last:border-b-0"
          >
            <dt className="proto-id truncate text-muted-foreground">{field.key}</dt>
            <dd className="break-words text-[13px] font-medium text-foreground">{field.value}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-border px-3.5 py-2.5">
        <p className="text-[11px] text-muted-foreground">
          Destination: <Id>{intent.destination}</Id>
        </p>
      </div>
    </Panel>
  );
}

function Simulation({ intent }: { intent: ActionIntent }) {
  const [stageIndex, setStageIndex] = useState(0);
  const stages = intent.simulation.stages;
  const isComplete = stageIndex >= stages.length;

  // Advance through stages deterministically.
  if (!isComplete) {
    setTimeout(() => setStageIndex((prev) => prev + 1), 600);
  }

  return (
    <Panel
      title="Simulated execution"
      note="Fixture prototype — no real system is contacted. Stages advance deterministically."
    >
      <ul className="flex flex-col">
        {stages.map((stage, index) => {
          const reached = index < stageIndex;
          const current = index === stageIndex;
          const terminal = stage.terminal;
          return (
            <li
              key={stage.id}
              className="flex items-start gap-3 border-b border-[var(--proto-hairline)] px-3.5 py-3 last:border-b-0"
            >
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                  reached
                    ? terminal === "succeeded"
                      ? "bg-[var(--success)]/20 text-[var(--success-ink)]"
                      : terminal === "waiting"
                        ? "bg-[var(--proto-tint-wait)] text-[var(--warning-ink)]"
                        : "bg-brand-tint text-brand-ink"
                    : current
                      ? "bg-brand-tint text-brand-ink"
                      : "bg-[var(--proto-mark-bg)] text-muted-foreground",
                )}
              >
                {reached ? (
                  terminal === "waiting" ? (
                    "·"
                  ) : (
                    <IconCheck size={11} aria-hidden />
                  )
                ) : current ? (
                  <span className="proto-pulse">·</span>
                ) : (
                  index + 1
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-[13px] font-semibold text-foreground">{stage.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  Actor: {stage.actor === "atlas" ? "Atlas" : systemLabel(stage.actor)}
                </p>
                {reached || current ? (
                  <p className="text-[12.5px] leading-[1.45] text-muted-foreground">
                    {stage.output}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {isComplete && intent.simulation.evidence.length > 0 ? (
        <div className="border-t border-border px-3.5 py-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Evidence recorded
          </p>
          <ul className="flex flex-col">
            {intent.simulation.evidence.map((ev) => (
              <EvidenceRow key={ev.id} evidence={ev} />
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
