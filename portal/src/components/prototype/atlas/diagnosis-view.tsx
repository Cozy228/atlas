/**
 * Prototype `atlas` — Diagnosis View
 * ===================================
 * Implements docs/app-centric-experience-architecture.md §6 & Atlas.md §三.4:
 * Diagnosis is a capability attached to a failed execution, answering:
 *   1. Failure locator (which run / stage failed and when)
 *   2. Ranked hypotheses with confidence level
 *   3. Lineage evidence with provenance and external references
 *   4. Governed recovery actions (human trigger, no silent auto-apply)
 *   5. Fallback pre-filled support ticket and escalation route
 */
import { useState } from "react";
import {
  IconAlertTriangle,
  IconArrowNarrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconExternalLink,
  IconLifebuoy,
  IconPlayerPlay,
  IconSparkles,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Diagnosis, Cause } from "@/components/prototype/opus/fixtures/types";
import { Chip, Id, ProvenanceTag } from "./ui";

export function DiagnosisView({
  diagnosis,
  compact = false,
  onOpenFull,
}: {
  diagnosis: Diagnosis;
  compact?: boolean;
  onOpenFull?: () => void;
}) {
  const [activeCauseId, setActiveCauseId] = useState<string>(diagnosis.causes[0]?.id ?? "");
  const [evidenceOpen, setEvidenceOpen] = useState(!compact);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const activeCause = diagnosis.causes.find((c) => c.id === activeCauseId) ?? diagnosis.causes[0];

  return (
    <div className="rounded-[4px] border border-border bg-surface overflow-hidden shadow-xs">
      {/* 1. Failure locator header */}
      <div className="border-b border-border bg-critical/[0.04] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-[3px] bg-critical/15 text-critical-ink">
              <IconAlertTriangle size={15} aria-hidden />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-critical-ink uppercase">
                  Stage Failed: {diagnosis.failedStageId}
                </span>
                <Chip tone="critical">
                  Run <Id>{diagnosis.runId}</Id>
                </Chip>
              </div>
              <h2 className="mt-1 text-[14px] font-bold text-foreground">{diagnosis.symptom}</h2>
            </div>
          </div>
          {compact && onOpenFull && (
            <Button variant="ghost" size="xs" onClick={onOpenFull}>
              Full Diagnosis <IconArrowNarrowRight size={13} aria-hidden />
            </Button>
          )}
        </div>

        {/* Quoted terminal output */}
        {diagnosis.quotedError && (
          <div className="mt-3 rounded-[3px] border border-border/80 bg-surface-2 p-2.5 font-mono text-[11.5px] leading-relaxed text-foreground">
            <span className="text-muted-foreground mr-2 select-none">$</span>
            {diagnosis.quotedError}
          </div>
        )}
      </div>

      {/* 2. Hypotheses with confidence rating */}
      <div className="border-b border-border">
        <div className="bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
          Ranked Probable Causes ({diagnosis.causes.length})
        </div>
        <div className="flex flex-col divide-y divide-border">
          {diagnosis.causes.map((cause) => (
            <CauseRow
              key={cause.id}
              cause={cause}
              isActive={cause.id === activeCauseId}
              onSelect={() => setActiveCauseId(cause.id)}
            />
          ))}
        </div>
      </div>

      {/* 3. Evidence Lineage (Supporting facts & logs) */}
      {activeCause && (
        <div className="border-b border-border">
          <div className="flex items-center justify-between bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
            <span>Evidence Lineage · {activeCause.id}</span>
            <button
              type="button"
              onClick={() => setEvidenceOpen(!evidenceOpen)}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground font-sans lowercase text-[11px]"
            >
              {evidenceOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              {evidenceOpen ? "hide details" : "show details"}
            </button>
          </div>

          {evidenceOpen && (
            <div className="p-4 flex flex-col gap-3">
              <p className="text-[12.5px] leading-relaxed text-foreground">
                <span className="font-semibold text-muted-foreground">Reasoning: </span>
                {activeCause.reasoning}
              </p>

              {activeCause.supporting.length > 0 && (
                <div className="flex flex-col divide-y divide-border/60 border-t border-border/60 pt-2">
                  {activeCause.supporting.map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-3 py-1.5 text-[12px]"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <ProvenanceTag provenance={ev.provenance} className="mt-0.5" />
                        <div>
                          <span className="font-medium text-foreground">{ev.label}: </span>
                          <span
                            className={cn(
                              "text-muted-foreground",
                              ev.mono && "font-mono font-semibold text-foreground",
                            )}
                          >
                            {ev.value}
                          </span>
                        </div>
                      </div>
                      {ev.systemId && (
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0 uppercase">
                          {ev.systemId}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Governed Recovery Actions */}
      <div className="border-b border-border">
        <div className="bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
          Governed Recovery Actions
        </div>
        <div className="flex flex-col divide-y divide-border">
          {diagnosis.recovery.map((opt) => (
            <div key={opt.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-foreground">{opt.label}</span>
                  {opt.recommended && (
                    <Chip tone="brand" className="text-[10px]">
                      <IconSparkles size={11} aria-hidden /> Recommended
                    </Chip>
                  )}
                  <Chip
                    tone={
                      opt.risk === "none" ? "success" : opt.risk === "low" ? "neutral" : "warning"
                    }
                  >
                    Risk: {opt.risk}
                  </Chip>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {opt.summary}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>
                    Executor: <Id>{opt.executedBy}</Id>
                  </span>
                  {opt.needsApprovalFrom && (
                    <span>
                      Approval:{" "}
                      <span className="font-semibold text-foreground">{opt.needsApprovalFrom}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 pt-0.5">
                {actionSuccess === opt.id ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled
                    className="text-success-ink border-success/40"
                  >
                    <IconCheck size={14} /> Action Triggered
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant={opt.recommended ? "default" : "outline"}
                    onClick={() => {
                      setActionSuccess(opt.id);
                      setTimeout(() => setActionSuccess(null), 4000);
                    }}
                  >
                    <IconPlayerPlay size={13} aria-hidden />
                    Execute Fix
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Fallback escalation */}
      <div className="flex items-center justify-between gap-3 bg-surface-2 px-4 py-2.5 text-[12px]">
        <div className="flex items-center gap-2 text-muted-foreground">
          <IconLifebuoy size={15} aria-hidden className="text-brand-ink" />
          <span>Need platform engineer escalation?</span>
        </div>
        <Button variant="outline" size="xs">
          Open Prefilled ITSM Ticket
          <IconExternalLink size={12} aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function CauseRow({
  cause,
  isActive,
  onSelect,
}: {
  cause: Cause;
  isActive: boolean;
  onSelect: () => void;
}) {
  const confPercent = Math.round(cause.confidence * 100);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start justify-between gap-3 p-3.5 text-left transition-colors",
        "hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isActive && "bg-brand-tint/40 border-l-2 border-brand",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground">{cause.claim}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
          {cause.reasoning}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span
          className={cn(
            "rounded-[2px] px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums",
            cause.confidenceLabel === "high"
              ? "bg-critical/15 text-critical-ink"
              : cause.confidenceLabel === "moderate"
                ? "bg-warning/20 text-warning-ink"
                : "bg-secondary text-muted-foreground",
          )}
        >
          {confPercent}% confidence
        </span>
        <span className="text-[10.5px] text-muted-foreground">{cause.ownerTeam}</span>
      </div>
    </button>
  );
}
