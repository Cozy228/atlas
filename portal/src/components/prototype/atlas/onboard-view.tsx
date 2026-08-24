import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconAlertTriangle,
  IconArrowNarrowRight,
  IconRefresh,
  IconRoute,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { elapsed, resolveApplication } from "./fixtures";
import type { JourneyStep } from "@/components/prototype/opus/fixtures/types";
import { Chip, Eyebrow, Id, Panel, ProvenanceTag } from "./ui";
import { DiagnosisView } from "./diagnosis-view";

export function OnboardingView() {
  const [selectedAppId, setSelectedAppId] = useState<string>("pay-refund-api");
  const [appCodeInput, setAppCodeInput] = useState<string>("PAY-4821");
  const [isResolved, setIsResolved] = useState<boolean>(true);
  const [activeStepId, setActiveStepId] = useState<string>("iac-workspace");

  const application = resolveApplication(selectedAppId);
  const [steps, setSteps] = useState<JourneyStep[]>(() => [...application.journey.steps]);

  const activeStep = steps.find((s) => s.id === activeStepId) ?? steps[0];
  const activeStepDiagnosis =
    activeStep.state === "failed" && application.diagnoses.length > 0
      ? application.diagnoses[0]
      : null;

  const completedCount = steps.filter(
    (s) => s.state === "verified" || s.state === "confirmed",
  ).length;
  const blockingStep = steps.find((s) => s.state === "failed" || s.state === "blocked");

  // Initial starter mode
  if (!isResolved) {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 py-12 px-4">
        <header className="bg-background">
          <Eyebrow>Golden Path · Managed Cloud Onboarding</Eyebrow>
          <h1 className="mt-2 text-[26px] font-bold tracking-tight text-foreground">
            Onboard a New Application
          </h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
            From application code to your first verified DEV deployment. Enter your approved
            Application Code to start; Atlas resolves team, account, and pipelines automatically.
          </p>
        </header>

        <Panel ticks className="p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (appCodeInput.trim()) {
                setIsResolved(true);
                if (appCodeInput.toUpperCase().includes("SRCH")) {
                  setSelectedAppId("search-indexer");
                  setActiveStepId("app-identified");
                } else {
                  setSelectedAppId("pay-refund-api");
                  setActiveStepId("iac-workspace");
                }
              }
            }}
            className="flex flex-col gap-4"
          >
            <div>
              <label
                htmlFor="app-code"
                className="block text-[12px] font-semibold text-foreground mb-1.5 uppercase tracking-wider font-mono"
              >
                Application Code
              </label>
              <input
                id="app-code"
                type="text"
                value={appCodeInput}
                onChange={(e) => setAppCodeInput(e.target.value)}
                placeholder="e.g. PAY-4821 or SRCH-9012"
                className="h-10 w-full rounded-[4px] border border-border bg-surface px-3 font-mono text-[14px] text-foreground focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                required
              />
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                Registered in the example application and access catalogs.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11.5px] text-muted-foreground">
                Quick load:{" "}
                <button
                  type="button"
                  onClick={() => setAppCodeInput("PAY-4821")}
                  className="font-mono text-brand-ink hover:underline mr-2"
                >
                  PAY-4821 (Mid-journey blocked)
                </button>
                <button
                  type="button"
                  onClick={() => setAppCodeInput("SRCH-9012")}
                  className="font-mono text-brand-ink hover:underline"
                >
                  SRCH-9012 (Completed)
                </button>
              </span>
              <Button type="submit">
                Start Golden Path <IconArrowNarrowRight size={14} aria-hidden />
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0 min-h-[calc(100dvh-56px)]">
      {/* Header bar */}
      <div className="border-b border-border bg-background px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid size-8 place-items-center rounded-[3px] bg-brand-tint text-brand-ink">
            <IconRoute size={18} aria-hidden />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Managed Cloud Golden Path
              </span>
              <Chip tone="brand">{application.code}</Chip>
              <span className="text-[12px] text-muted-foreground">· {application.name}</span>
            </div>
            <p className="text-[13px] font-bold text-foreground">
              {application.journey.goldenPathLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-[14px] font-bold tabular-nums text-foreground">
              {completedCount}{" "}
              <span className="text-muted-foreground text-[12px]">/ {steps.length} steps</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Elapsed {elapsed(application.journey.startedAt)}
            </div>
          </div>
          <Button variant="outline" size="xs" onClick={() => setIsResolved(false)}>
            Switch App
          </Button>
          {completedCount === steps.length && (
            <Button
              size="sm"
              render={<Link to="/prototype/$appId/overview" params={{ appId: application.id }} />}
            >
              Open Workbench <IconArrowNarrowRight size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Main split: Left vertical DAG step rail, Right Step Workspace */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Left rail */}
        <aside className="w-full md:w-72 border-r border-border bg-card/60 flex flex-col shrink-0">
          <div className="p-3 border-b border-border text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground flex items-center justify-between">
            <span>Path Steps</span>
            {blockingStep && (
              <span className="text-critical-ink flex items-center gap-1 font-bold">
                <IconAlertTriangle size={12} /> 1 Blocked
              </span>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {steps.map((step, idx) => {
              const isSelected = step.id === activeStep.id;
              const isDone = step.state === "verified" || step.state === "confirmed";
              const isFailed = step.state === "failed" || step.state === "blocked";
              const isWaiting = step.state === "waiting";

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStepId(step.id)}
                  className={cn(
                    "flex items-start gap-2.5 rounded-[4px] p-2 text-left transition-colors",
                    "hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected && "bg-brand-tint/60 text-brand-ink font-semibold shadow-sm",
                    isFailed && !isSelected && "bg-critical/[0.06] text-critical-ink",
                  )}
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[10.5px] font-mono font-bold">
                    {isDone ? (
                      <span className="grid size-4 place-items-center rounded-full bg-success/15 text-success-ink">
                        ✓
                      </span>
                    ) : isFailed ? (
                      <span className="grid size-4 place-items-center rounded-full bg-critical/20 text-critical-ink">
                        ✕
                      </span>
                    ) : isWaiting ? (
                      <span className="grid size-4 place-items-center rounded-full bg-warning/20 text-warning-ink">
                        •
                      </span>
                    ) : (
                      <span className="grid size-4 place-items-center rounded-full bg-secondary text-muted-foreground">
                        {idx + 1}
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] leading-tight">{step.title}</div>
                    <div className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
                      {step.executedBy}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right workspace (Main Stage) */}
        <main className="flex-1 overflow-y-auto bg-coordinate-grid p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-[820px] flex flex-col gap-6">
            {/* Active Step Header */}
            <header className="flex flex-wrap items-start justify-between gap-4 bg-background pb-1">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Phase: {activeStep.phaseId}
                  </span>
                  <StepStateChip state={activeStep.state} />
                </div>
                <h2 className="mt-1 text-[22px] font-bold text-foreground">{activeStep.title}</h2>
                <p className="mt-1 max-w-[65ch] text-[13.5px] leading-relaxed text-muted-foreground">
                  {activeStep.intent}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[11px] text-muted-foreground">
                  Executor: <Id>{activeStep.executedBy}</Id>
                </span>
              </div>
            </header>

            {/* In-place full diagnosis if step has an unresolved failure */}
            {activeStepDiagnosis && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-critical-ink px-1 font-bold">
                  <span>Blocking Failure & Diagnosis</span>
                  <span>Requires Resolution</span>
                </div>
                <DiagnosisView diagnosis={activeStepDiagnosis} />
              </div>
            )}

            {/* Unified Step Intelligence Panel */}
            {(activeStep.facts || activeStep.evidence || activeStep.decision) && (
              <div className="rounded-[4px] border border-border bg-surface overflow-hidden shadow-xs">
                {/* Facts established in this step */}
                {activeStep.facts && activeStep.facts.length > 0 && (
                  <div className="border-b border-border">
                    <div className="bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                      Established Properties ({activeStep.facts.length})
                    </div>
                    <div className="flex flex-col divide-y divide-border">
                      {activeStep.facts.map((fact) => (
                        <div
                          key={fact.id}
                          className="flex flex-wrap items-start justify-between gap-3 p-3.5 text-[12.5px]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <ProvenanceTag provenance={fact.provenance} />
                              <span className="font-semibold text-foreground">{fact.label}</span>
                              {fact.systemId && (
                                <span className="font-mono text-[10.5px] text-muted-foreground uppercase">
                                  [{fact.systemId}]
                                </span>
                              )}
                            </div>
                            <div className="mt-1 font-mono text-[13px] font-bold text-brand-ink truncate">
                              {fact.value}
                            </div>
                            {fact.method && (
                              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                                {fact.method}
                              </p>
                            )}
                          </div>
                          <div className="text-right text-[11px] font-mono text-muted-foreground shrink-0">
                            {fact.externalId}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidence & artifacts recorded */}
                {activeStep.evidence && activeStep.evidence.length > 0 && (
                  <div className="border-b border-border">
                    <div className="bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                      Verified Cryptographic Evidence
                    </div>
                    <div className="flex flex-col divide-y divide-border">
                      {activeStep.evidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 text-[12px]"
                        >
                          <div className="flex items-center gap-2">
                            <ProvenanceTag provenance={ev.provenance} />
                            <span className="font-medium text-foreground">{ev.label}:</span>
                            <span className="font-mono font-semibold text-foreground">
                              {ev.value}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {ev.recordedAt.slice(0, 10)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Decision panel if step required decision */}
                {activeStep.decision && (
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Workload Decision
                      </span>
                      <Chip tone="brand">Governed Choice</Chip>
                    </div>
                    <p className="text-[13px] font-bold text-foreground">
                      {activeStep.decision.question}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {activeStep.decision.options.map((opt) => {
                        const isChosen = opt.id === activeStep.decision?.chosenOptionId;
                        return (
                          <div
                            key={opt.id}
                            className={cn(
                              "rounded-[4px] border p-3 text-[12px] flex flex-col justify-between",
                              isChosen
                                ? "border-brand bg-brand-tint/30 shadow-sm"
                                : "border-border bg-surface-2 opacity-85",
                            )}
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground">{opt.label}</span>
                                {opt.recommended && (
                                  <Chip tone="brand" className="text-[9.5px]">
                                    Recommended
                                  </Chip>
                                )}
                              </div>
                              <p className="mt-1 text-muted-foreground text-[11.5px] leading-relaxed">
                                {opt.detail}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Bar Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <ProvenanceTag provenance="observed" />

                <span>Lineage tracked in Atlas Context Graph</span>
              </div>
              <div className="flex items-center gap-2">
                {activeStep.state === "blocked" || activeStep.state === "failed" ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setSteps((prev) =>
                        prev.map((s) => (s.id === activeStep.id ? { ...s, state: "verified" } : s)),
                      );
                    }}
                  >
                    <IconRefresh size={14} /> Retry Verification
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const nextIdx = steps.findIndex((s) => s.id === activeStep.id) + 1;
                      if (nextIdx < steps.length) {
                        setActiveStepId(steps[nextIdx].id);
                      }
                    }}
                  >
                    Next Step <IconArrowNarrowRight size={14} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function StepStateChip({ state }: { state: JourneyStep["state"] }) {
  switch (state) {
    case "verified":
    case "confirmed":
      return <Chip tone="success">Verified</Chip>;
    case "failed":
      return <Chip tone="critical">Failed</Chip>;
    case "blocked":
      return <Chip tone="critical">Blocked</Chip>;
    case "waiting":
      return <Chip tone="warning">Waiting</Chip>;
    case "running":
      return <Chip tone="brand">Running</Chip>;
    case "waived":
      return <Chip tone="neutral">Waived</Chip>;
    case "off-branch":
      return <Chip tone="neutral">Off-branch</Chip>;
    default:
      return <Chip tone="neutral">Ready</Chip>;
  }
}
