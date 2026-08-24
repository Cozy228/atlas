import { useState } from "react";
import { IconAlertTriangle, IconCheck, IconRocket } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Application, Run } from "./fixtures";
import { Chip, Eyebrow, StatusDot } from "./ui";

import { DiagnosisView } from "./diagnosis-view";

export function DeliveryView({ application }: { application: Application }) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    application.runs.find((r) => r.result === "failed")?.id ?? null,
  );
  const [deployTriggered, setDeployTriggered] = useState(false);

  const selectedRun = application.runs.find((r) => r.id === selectedRunId);
  const diagnosis = application.diagnoses.find((d) => d.runId === selectedRunId);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 bg-background pr-1">
        <div>
          <Eyebrow>Workbench · Delivery</Eyebrow>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-foreground">
            Delivery & Environments
          </h1>
          <p className="mt-1 max-w-[65ch] text-[13px] leading-relaxed text-muted-foreground">
            Environment flow, version drift, and execution pipeline runs for {application.name}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {deployTriggered ? (
            <Button
              size="sm"
              variant="outline"
              disabled
              className="text-success-ink border-success/40"
            >
              <IconCheck size={14} /> DEV Deployment Triggered (#1435)
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => {
                setDeployTriggered(true);
                setTimeout(() => setDeployTriggered(false), 5000);
              }}
            >
              <IconRocket size={14} aria-hidden />
              Trigger DEV Deployment
            </Button>
          )}
        </div>
      </header>

      {/* 1. Horizontal Environment Pipeline Track */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-1">
          <span>Environment Promotion Track · Version Alignment</span>
          <span>Automated Quality Gates</span>
        </div>

        <div className="rounded-[4px] border border-border bg-surface p-4">
          <div className="flex flex-col md:flex-row items-stretch justify-between gap-4 relative">
            {/* DEV Stage */}
            <div className="flex-1 rounded-[3px] border border-border bg-surface-2 p-3 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-foreground uppercase">
                  1. DEV Environment
                </span>
                <Chip tone="success">Live</Chip>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[16px] font-bold text-brand-ink">v2.4.1</span>
                <span className="font-mono text-[11px] text-muted-foreground">#1425</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                <StatusDot state="healthy" /> 100% healthy pods (2/2)
              </div>
            </div>

            {/* Pipeline connector arrow 1 */}
            <div className="hidden md:flex items-center justify-center text-muted-foreground font-mono text-[12px]">
              {"──────>"}
            </div>

            {/* UAT Stage */}
            <div className="flex-1 rounded-[3px] border border-border bg-surface-2 p-3 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-foreground uppercase">
                  2. UAT Staging
                </span>
                <Chip tone="neutral">Staged</Chip>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[16px] font-bold text-foreground">v2.4.1</span>
                <span className="font-mono text-[11px] text-success-ink font-semibold">Synced</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                <StatusDot state="healthy" /> Integration verified
              </div>
            </div>

            {/* Pipeline connector arrow 2 */}
            <div className="hidden md:flex items-center justify-center text-warning-ink font-mono text-[12px]">
              {"──────>"}
            </div>

            {/* PROD Stage */}
            <div className="flex-1 rounded-[3px] border border-warning/40 bg-warning/[0.05] p-3 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold text-foreground uppercase">
                  3. PROD Cluster
                </span>
                <Chip tone="warning">Drift -1</Chip>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[16px] font-bold text-warning-ink">v2.3.9</span>
                <span className="font-mono text-[11px] text-warning-ink font-bold">
                  1 release behind
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                <StatusDot state="degraded" /> Hotfix v2.4.1 pending
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main split: Run History Table & In-Place Diagnosis View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Run history table */}
        <div className={cn("flex flex-col gap-4", diagnosis ? "lg:col-span-6" : "lg:col-span-12")}>
          <div className="rounded-[4px] border border-border bg-surface overflow-hidden">
            <div className="bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
              Pipeline Runs & Executions
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12.5px]">
                <thead className="border-b border-border bg-surface-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3.5 py-2.5">Run #</th>
                    <th className="px-3.5 py-2.5">Environment</th>
                    <th className="px-3.5 py-2.5">Result</th>
                    <th className="px-3.5 py-2.5">Duration</th>
                    <th className="px-3.5 py-2.5">Triggered By</th>
                    <th className="px-3.5 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {application.runs.map((run) => {
                    const isSelected = run.id === selectedRunId;
                    const isFailed = run.result === "failed";

                    return (
                      <tr
                        key={run.id}
                        className={cn(
                          "transition-colors hover:bg-secondary/60 cursor-pointer",
                          isSelected && "bg-brand-tint/50 font-medium",
                          isFailed && !isSelected && "bg-critical/[0.03]",
                        )}
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        <td className="px-3.5 py-3 font-mono font-bold text-foreground">
                          {run.id}
                        </td>
                        <td className="px-3.5 py-3 font-mono text-muted-foreground uppercase text-[11px]">
                          {run.environment}
                        </td>
                        <td className="px-3.5 py-3">
                          <RunStatusBadge result={run.result} />
                        </td>
                        <td className="px-3.5 py-3 font-mono tabular-nums text-muted-foreground text-[11.5px]">
                          {Math.round(run.durationMs / 1000)}s
                        </td>
                        <td className="px-3.5 py-3 text-muted-foreground text-[12px] truncate max-w-[120px]">
                          {run.triggeredBy}
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          {run.diagnosisId ? (
                            <Button
                              variant={isSelected ? "default" : "outline"}
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRunId(run.id);
                              }}
                            >
                              <IconAlertTriangle size={12} />
                              Diagnose
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">View</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stages of selected run */}
          {selectedRun && (
            <div className="rounded-[4px] border border-border bg-surface overflow-hidden">
              <div className="bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 flex items-center justify-between">
                <span>Stage Breakdown · {selectedRun.id}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {selectedRun.label}
                </span>
              </div>
              <div className="flex flex-col divide-y divide-border p-2">
                {selectedRun.stages.map((stg) => (
                  <div
                    key={stg.id}
                    className="flex items-start justify-between gap-3 p-2.5 text-[12px]"
                  >
                    <div className="flex items-center gap-2">
                      <StageIcon state={stg.state} />
                      <span className="font-semibold text-foreground">{stg.label}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      {stg.durationMs && <span>{Math.round(stg.durationMs / 1000)}s</span>}
                      <span className="capitalize">{stg.state}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* In-place diagnosis side panel */}
        {diagnosis && (
          <div className="lg:col-span-6 flex flex-col gap-4">
            <DiagnosisView diagnosis={diagnosis} />
          </div>
        )}
      </div>
    </div>
  );
}

function RunStatusBadge({ result }: { result: Run["result"] }) {
  switch (result) {
    case "succeeded":
      return <Chip tone="success">Success</Chip>;
    case "failed":
      return <Chip tone="critical">Failed</Chip>;
    case "running":
      return <Chip tone="brand">Running</Chip>;
    case "waiting":
      return <Chip tone="warning">Waiting</Chip>;
  }
}

function StageIcon({ state }: { state: string }) {
  if (state === "passed") {
    return (
      <span className="grid size-4 place-items-center rounded-full bg-success/20 text-success-ink text-[10px] font-bold">
        ✓
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="grid size-4 place-items-center rounded-full bg-critical/20 text-critical-ink text-[10px] font-bold">
        ✕
      </span>
    );
  }
  return (
    <span className="grid size-4 place-items-center rounded-full bg-secondary text-muted-foreground text-[10px]">
      ●
    </span>
  );
}
