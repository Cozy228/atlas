/**
 * Prototype "kimi" — Action run detail.
 *
 * Every governed action produces an addressable run: status with a human
 * label, the inputs that were sent, a step log, links out to the executing
 * system's evidence, and a path into diagnosis when it failed. Fixture runs
 * are deterministic; simulated runs (created by the scaffolder or diagnosis)
 * advance along their plan while this page is open and persist in
 * sessionStorage.
 */

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconCheck,
  IconCircleDashed,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { Run, RunStep } from "./fixtures";
import { APP_MAP, SOURCES, diagnosesForApp, getFixtureRun, personName } from "./fixtures";
import { advanceSimulatedRun, getSimulatedRun, saveSimulatedRun } from "./run-store";
import { usePrototypeApp } from "./shell";
import { EmptyState, KeyVal, Mono, PageHead, Panel, SectionHead, StatusDot, fmtUtc } from "./ui";

const RUN_STATUS_LABEL: Record<Run["status"], string> = {
  queued: "Queued",
  running: "Running",
  "waiting-approval": "Waiting for approval",
  success: "Success",
  failed: "Failed",
};

const STEP_ICON: Record<RunStep["status"], typeof IconCheck> = {
  done: IconCheck,
  failed: IconX,
  running: IconLoader2,
  pending: IconCircleDashed,
};

const STEP_ICON_CLASS: Record<RunStep["status"], string> = {
  done: "text-success-ink",
  failed: "text-critical-ink",
  running: "text-brand-ink",
  pending: "text-muted-foreground",
};

export function RunDetailPage({ runId }: { runId: string }) {
  const { appId } = usePrototypeApp();
  const [run, setRun] = useState<Run | undefined>(() => {
    return getFixtureRun(runId) ?? getSimulatedRun(runId);
  });

  // Advance simulated runs along their deterministic plan while open.
  useEffect(() => {
    if (!run?.simulated || !run.intentId) return;
    if (run.status !== "running" && run.status !== "queued") return;
    const timer = window.setTimeout(() => {
      const current = getSimulatedRun(run.id);
      if (!current || !current.intentId) return;
      const next = advanceSimulatedRun(current, current.intentId);
      saveSimulatedRun(next);
      setRun({ ...next });
    }, 950);
    return () => window.clearTimeout(timer);
  }, [run]);

  if (!run) {
    return (
      <div className="flex flex-col gap-5">
        <PageHead contour title="Run not found" />
        <EmptyState
          title={`No run "${runId}" in this context`}
          body="Fixture runs and runs simulated in this browser session are addressable here. A simulated run from another tab or an expired session is gone by design."
          action={
            <Button
              nativeButton={false}
              size="sm"
              variant="outline"
              render={
                <Link to="/prototype/kimi/dashboard" search={{ app: appId }}>
                  Back to dashboard
                </Link>
              }
            />
          }
        />
      </div>
    );
  }

  const app = APP_MAP[run.appId];
  const durationSec = run.endedAt
    ? Math.round((Date.parse(run.endedAt) - Date.parse(run.startedAt)) / 1000)
    : null;
  const hasDiagnosis = diagnosesForApp(run.appId).some((c) => c.runId === run.id);

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        contour
        title={run.action}
        description={
          <>
            Run <Mono>{run.id}</Mono>
            {run.simulated ? " (simulated in this session)" : ""} · executed by{" "}
            {SOURCES[run.targetSystem].label}, observed by Atlas.
          </>
        }
        meta={
          <Badge
            variant={
              run.status === "success"
                ? "success"
                : run.status === "failed"
                  ? "critical"
                  : run.status === "waiting-approval"
                    ? "warning"
                    : "brand"
            }
          >
            {RUN_STATUS_LABEL[run.status]}
          </Badge>
        }
      />

      <Panel className="px-5 py-4" aria-live="polite">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          <KeyVal k="Application">
            {app.name} <Mono>{app.code}</Mono>
          </KeyVal>
          <KeyVal k="Executing system">{SOURCES[run.targetSystem].label}</KeyVal>
          <KeyVal k="Triggered by">{personName(run.triggeredById)}</KeyVal>
          <KeyVal k="Started">{fmtUtc(run.startedAt)}</KeyVal>
          <KeyVal k="Duration">
            {durationSec !== null ? `${durationSec}s` : run.status === "running" ? "running" : "—"}
          </KeyVal>
          <KeyVal k="Status detail">{run.statusLabel ?? RUN_STATUS_LABEL[run.status]}</KeyVal>
        </dl>
      </Panel>

      {run.status === "waiting-approval" ? (
        <Panel className="border-warning/50 bg-warning/8 px-5 py-4">
          <div className="flex items-start gap-3">
            <StatusDot tone="warning" className="mt-1.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Waiting for approval in {SOURCES[run.targetSystem].label}
              </p>
              <p className="mt-0.5 max-w-[70ch] text-[13px] leading-relaxed text-muted-foreground">
                The approval decision belongs to the approver in the source system. Atlas does not
                approve on anyone's behalf; it re-checks the request and updates this run when the
                decision lands.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      {run.error ? (
        <Panel className="border-critical/40 bg-critical/6 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusDot tone="critical" />
            <p className="text-sm font-semibold text-foreground">
              {run.error.class} at "{run.error.stage}"
            </p>
          </div>
          <p className="mt-1 font-mono text-[12px] leading-relaxed text-foreground">
            {run.error.message}
          </p>
          {hasDiagnosis ? (
            <Button
              nativeButton={false}
              size="sm"
              className="mt-3"
              render={
                <Link to="/prototype/kimi/diagnosis" search={{ app: run.appId, run: run.id }}>
                  Open diagnosis
                  <IconArrowRight size={14} strokeWidth={2} aria-hidden />
                </Link>
              }
            />
          ) : null}
        </Panel>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Step log */}
        <div className="lg:col-span-3">
          <SectionHead title="Step log" hint="reported by the executing system" className="mb-2" />
          <Panel className="px-5 py-3">
            <ol className="flex flex-col divide-y divide-border">
              {run.steps.map((step, index) => {
                const StepIcon = STEP_ICON[step.status];
                return (
                  <li key={`${step.label}-${index}`} className="flex items-start gap-3 py-2.5">
                    <StepIcon
                      size={15}
                      strokeWidth={2}
                      aria-hidden
                      className={cn(
                        "mt-0.5 shrink-0",
                        STEP_ICON_CLASS[step.status],
                        step.status === "running" && "animate-spin [animation-duration:1.6s]",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[13px]",
                          step.status === "pending"
                            ? "text-muted-foreground"
                            : "font-medium text-foreground",
                        )}
                      >
                        {step.label}
                      </p>
                      {step.detail ? (
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          {step.detail}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                      {step.status === "pending" ? "pending" : fmtUtc(step.at)}
                    </span>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>

        {/* Inputs */}
        <div className="lg:col-span-2">
          <SectionHead
            title="Inputs sent"
            hint="exactly what the system received"
            className="mb-2"
          />
          {run.inputs && Object.keys(run.inputs).length > 0 ? (
            <Panel>
              <ul className="divide-y divide-border">
                {Object.entries(run.inputs).map(([key, value]) => (
                  <li key={key} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="text-xs text-muted-foreground">{key}</span>
                    <Mono>{value}</Mono>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : (
            <Panel className="px-4 py-3">
              <p className="text-[13px] text-muted-foreground">No inputs recorded for this run.</p>
            </Panel>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            External console links are intentionally inert in this prototype; the identifiers above
            are the evidence handles.
          </p>
        </div>
      </div>
    </div>
  );
}
