import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconClock,
  IconExternalLink,
  IconGitBranch,
  IconInfoCircle,
  IconListCheck,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";

import { APP_CONTEXT, EXTERNAL_WAIT, JOURNEY_PHASES } from "./fixtures";
import { JourneyRail, PrototypePanel } from "./ui";

const STATUS_BADGE = {
  complete: "success",
  blocked: "critical",
  waiting: "warning",
  upcoming: "neutral",
} as const;

export function CodexOnboarding() {
  const [selectedStepId, setSelectedStepId] = useState("runtime");
  const selectedStep = useMemo(
    () =>
      JOURNEY_PHASES.flatMap((phase) => phase.steps).find((step) => step.id === selectedStepId)!,
    [selectedStepId],
  );

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px_auto] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Golden Path · version 1.4
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
            First DEV deployment
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            A stateful journey for {APP_CONTEXT.name}. Progress comes from observed evidence, not a
            manual checklist.
          </p>
        </div>
        <Progress value={60} className="gap-2" aria-label="Onboarding completion">
          <ProgressLabel>Journey completion</ProgressLabel>
          <ProgressValue>{() => "6 of 10 complete"}</ProgressValue>
        </Progress>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to="/prototype/codex/dashboard" />}
        >
          Back to dashboard
        </Button>
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[370px_minmax(0,1fr)]">
        <PrototypePanel className="min-w-0 p-5 lg:sticky lg:top-20 lg:self-start">
          <div className="mb-5 flex items-start gap-3 border-b border-border pb-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand-ink">
              <IconListCheck className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-semibold">{APP_CONTEXT.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {APP_CONTEXT.code} · {APP_CONTEXT.environment} · Owner {APP_CONTEXT.owner}
              </p>
            </div>
          </div>
          <JourneyRail
            phases={JOURNEY_PHASES}
            selectedStep={selectedStepId}
            onSelect={setSelectedStepId}
          />
        </PrototypePanel>

        <div className="flex min-w-0 flex-col gap-4">
          <PrototypePanel className="overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between lg:px-6">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_BADGE[selectedStep.status]}>{selectedStep.status}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Owner · {selectedStep.owner}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-[-0.025em]">
                  {selectedStep.label}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {selectedStep.status === "complete"
                    ? "Atlas observed the completion evidence below. This step does not need manual confirmation."
                    : selectedStep.status === "blocked"
                      ? "A runtime key mismatch blocks the first DEV deployment. Review the known context and start a governed recovery action."
                      : "This step remains unavailable until the current blocker is resolved and verified."}
                </p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                STEP · {selectedStep.id}
              </span>
            </div>

            <div className="flex flex-col gap-5 p-5 lg:p-6">
              {selectedStep.status === "complete" ? (
                <section aria-labelledby="completion-evidence-title">
                  <h3 id="completion-evidence-title" className="font-semibold">
                    Completion evidence
                  </h3>
                  <div className="mt-3 rounded-md border border-success/40 bg-success/[0.045] p-4">
                    <p className="text-sm font-semibold text-success-ink">Observed and verified</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {selectedStep.evidence ??
                        "Evidence is available from the owning source system."}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Retrieved Aug 14, 2026 · 09:12 UTC · Fresh 11m ago
                    </p>
                  </div>
                </section>
              ) : selectedStep.status === "blocked" ? (
                <BlockedStep />
              ) : (
                <section className="rounded-md border border-border bg-muted/35 p-5 text-center">
                  <IconClock className="mx-auto size-6 text-muted-foreground" aria-hidden />
                  <h3 className="mt-3 font-semibold">Waiting on the current journey state</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Atlas will unlock this step after runtime configuration succeeds and the source
                    system reports completion evidence.
                  </p>
                </section>
              )}
            </div>
          </PrototypePanel>

          <div className="grid gap-4 md:grid-cols-2">
            <PrototypePanel className="p-5">
              <div className="flex items-start gap-3">
                <IconClock className="mt-0.5 size-5 shrink-0 text-warning-ink" aria-hidden />
                <div>
                  <h2 className="font-semibold">External waiting</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {EXTERNAL_WAIT.status}. Atlas cannot accelerate or impersonate the source owner.
                  </p>
                  <dl className="mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-xs">
                    <dt className="text-muted-foreground">Reference</dt>
                    <dd className="font-mono font-semibold">{EXTERNAL_WAIT.requestId}</dd>
                    <dt className="text-muted-foreground">Source owner</dt>
                    <dd>{EXTERNAL_WAIT.owner}</dd>
                    <dt className="text-muted-foreground">Next check</dt>
                    <dd>{EXTERNAL_WAIT.nextCheck}</dd>
                  </dl>
                </div>
              </div>
            </PrototypePanel>

            <PrototypePanel className="p-5">
              <div className="flex items-start gap-3">
                <IconGitBranch className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden />
                <div>
                  <h2 className="font-semibold">Branching path</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Endpoint exposure is a product decision. Atlas will ask once, then derive the
                    remaining fixture configuration from policy and application context.
                  </p>
                  <Link
                    to="/prototype/codex/scaffolder"
                    className="mt-3 inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-brand-ink hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Review the decision
                    <IconArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </PrototypePanel>
          </div>
        </div>
      </div>
    </div>
  );
}

function BlockedStep() {
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="blocker-prerequisites-title">
        <h3 id="blocker-prerequisites-title" className="font-semibold">
          Prerequisites
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["Repository", "Ready", "Source control · 9m ago"],
            ["Delivery target", "Ready", "Delivery platform · 7m ago"],
            ["Secret contract", "Mismatch", "Derived · 4m ago"],
          ].map(([label, value, source]) => (
            <div key={label} className="rounded-md border border-border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
                {label}
              </p>
              <p className="mt-2 font-semibold">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{source}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-critical/35 bg-critical/[0.045] p-4">
        <h3 className="font-semibold text-critical-ink">Why this is blocked</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The DEV deployment specification references{" "}
          <code className="font-mono text-xs font-semibold">DB_PASS</code>, while the service
          manifest declares <code className="font-mono text-xs font-semibold">DB_PASSWORD</code>.
          Atlas found no exact contract match.
        </p>
      </section>

      <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <IconInfoCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Actions are simulated. Atlas will prepare inputs but will not apply a production change.
        </p>
        <Button size="lg" nativeButton={false} render={<Link to="/prototype/codex/scaffolder" />}>
          Start governed recovery
          <IconExternalLink data-icon="inline-end" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
