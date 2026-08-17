import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconAlertOctagon,
  IconArrowRight,
  IconChevronRight,
  IconCircleCheck,
  IconExternalLink,
  IconFlag3,
  IconGitBranch,
  IconInfoCircle,
  IconShieldCheck,
  IconTicket,
  IconUsers,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

import { APP_CONTEXT, BLOCKER_EVIDENCE, JOURNEY_PHASES, RUN_TIMELINE } from "./fixtures";
import { EvidenceList, JourneyRail, PrototypePanel } from "./ui";

const DASHBOARD_JOURNEY_PHASES = JOURNEY_PHASES.map((phase) =>
  phase.id === "prepare"
    ? { ...phase, steps: phase.steps.filter((step) => step.id !== "owner") }
    : phase,
);

export function CodexDashboard() {
  const [selectedEvidence, setSelectedEvidence] = useState<string>();
  const [ticketPrepared, setTicketPrepared] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-none flex-col gap-5 px-4 py-5 sm:px-6 lg:pr-[49px] lg:pl-[35px]">
      <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_326px_156px] lg:items-center lg:gap-x-[72px]">
        <div className="flex min-w-0 items-start gap-7">
          <span className="flex size-[72px] shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
            <IconFlag3 className="size-9" stroke={2} aria-hidden />
          </span>
          <div className="min-w-0 pt-1.5">
            <h1 className="text-[30px] leading-9 font-bold tracking-[-0.035em]">
              Get {APP_CONTEXT.name} to DEV
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              First deployment journey to DEV for {APP_CONTEXT.name}.
            </p>
          </div>
        </div>

        <div>
          <p className="text-center text-[13px] text-muted-foreground">6 of 10 steps</p>
          <Progress value={60} className="mt-2 gap-0" aria-label="Journey progress" />
        </div>

        <Button
          variant="outline"
          size="lg"
          nativeButton={false}
          render={<Link to="/prototype/codex/onboarding" />}
          className="h-11 w-full rounded-md text-[14px] font-medium lg:-translate-x-1.5"
        >
          Open journey
          <IconExternalLink data-icon="inline-end" aria-hidden />
        </Button>
      </header>

      <div className="grid min-w-0 gap-3.5 lg:grid-cols-[362px_minmax(0,1fr)]">
        <PrototypePanel className="flex min-h-[777px] min-w-0 flex-col p-6 lg:sticky lg:top-[76px] lg:self-start">
          <JourneyRail phases={DASHBOARD_JOURNEY_PHASES} selectedStep="runtime" />
          <div className="-mx-1 -mb-[7px] mt-auto flex min-h-[84px] -translate-x-px items-center gap-3 rounded-md border border-border bg-card px-4 py-3">
            <IconGitBranch className="size-7 shrink-0 text-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold">Branch detected</span>
              <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">
                {APP_CONTEXT.branch} → main
              </span>
            </span>
            <IconChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </div>
        </PrototypePanel>

        <PrototypePanel className="min-w-0 overflow-hidden">
          <div className="grid min-h-[128px] gap-4 border-b border-border px-6 py-6 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:gap-7">
            <IconAlertOctagon
              className="mt-1 size-12 shrink-0 text-critical-ink"
              stroke={2.25}
              aria-hidden
            />
            <div className="min-w-0 pt-2.5">
              <h2 className="text-[28px] leading-9 font-bold tracking-[-0.025em]">
                Resolve the runtime blocker
              </h2>
              <p className="mt-2 max-w-3xl text-[13px] leading-5 text-muted-foreground">
                The service references secret key{" "}
                <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-critical-ink">
                  DB_PASS
                </code>
                , but the declared runtime key is{" "}
                <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-critical-ink">
                  DB_PASSWORD
                </code>
                .
              </p>
            </div>
            <div className="shrink-0 pt-1 text-left sm:text-right">
              <span className="text-[28px] leading-8 font-bold tabular-nums text-critical">
                82%
              </span>
              <span className="mt-1 block text-[11px] text-muted-foreground">confidence</span>
            </div>
          </div>

          <div className="flex flex-col gap-4 px-6 pt-[19px] pb-6">
            <section aria-labelledby="dashboard-evidence-title">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 id="dashboard-evidence-title" className="text-[14px] font-semibold">
                  Evidence
                </h3>
                <span className="text-[12px] text-muted-foreground">3 items</span>
              </div>
              <EvidenceList
                items={BLOCKER_EVIDENCE}
                selectedId={selectedEvidence}
                onSelect={(id) =>
                  setSelectedEvidence((current) => (current === id ? undefined : id))
                }
              />
            </section>

            <aside className="flex min-h-[74px] flex-col gap-3 rounded-md border border-warning/35 bg-warning/[0.025] px-3.5 py-3 text-[12px] sm:flex-row sm:items-center">
              <IconInfoCircle className="size-6 shrink-0 text-warning-ink" aria-hidden />
              <div className="min-w-0 flex-1">
                <p>
                  <span className="mr-4 text-[14px] font-semibold text-foreground">Unknown</span>
                  <span className="text-muted-foreground">
                    Secret source is not available to Atlas.
                  </span>
                </p>
                <p className="mt-1 leading-5 text-muted-foreground">
                  Atlas cannot read the database password from the configured secret manager.
                </p>
              </div>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-2 font-semibold text-brand-ink hover:underline"
              >
                Learn more
                <IconExternalLink className="size-4" aria-hidden />
              </button>
            </aside>

            <section aria-labelledby="dashboard-ownership-title">
              <h3 id="dashboard-ownership-title" className="mb-2 text-[14px] font-semibold">
                Ownership
              </h3>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <div className="flex min-h-[70px] items-center gap-3 rounded-md border border-border bg-background px-4 py-3">
                  <IconUsers className="size-7 shrink-0 text-brand-ink" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">Application Team</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Can correct the declaration.
                    </p>
                  </div>
                  <p className="shrink-0 text-[10px] text-muted-foreground">Owner</p>
                </div>
                <div className="flex min-h-[70px] items-center gap-3 rounded-md border border-border bg-background px-4 py-3">
                  <IconShieldCheck className="size-7 shrink-0 text-brand-ink" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold">Platform Support</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Escalate if the source remains unavailable.
                    </p>
                  </div>
                  <p className="shrink-0 text-[10px] text-muted-foreground">Escalation owner</p>
                </div>
              </div>
            </section>

            <section aria-labelledby="dashboard-recovery-title">
              <h3 id="dashboard-recovery-title" className="mb-[7px] text-[14px] font-semibold">
                Safe recovery preview
              </h3>
              <div className="box-border grid min-h-[93px] gap-4 rounded-md border border-primary/45 bg-primary/[0.02] px-3.5 py-3 md:grid-cols-[minmax(0,1fr)_370px] md:items-center">
                <div className="flex items-start gap-4">
                  <IconInfoCircle className="mt-0.5 size-6 shrink-0 text-brand-ink" aria-hidden />
                  <div>
                    <p className="max-w-[390px] text-[11px] leading-5 text-muted-foreground">
                      Atlas can prepare a corrected deployment specification and observe a new DEV
                      validation run.
                    </p>
                    <p className="mt-1 text-[11px] font-semibold leading-5">
                      Atlas cannot approve, grant access, or modify production autonomously.
                    </p>
                  </div>
                </div>
                <ol className="flex flex-col gap-1 text-[11px] leading-5 text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <IconCircleCheck className="size-3.5" aria-hidden />
                    Prepare corrected deployment spec
                  </li>
                  <li className="flex items-center gap-2">
                    <IconCircleCheck className="size-3.5" aria-hidden />
                    Observe new DEV validation run
                  </li>
                  <li className="flex items-center gap-2">
                    <IconCircleCheck className="size-3.5" aria-hidden />
                    Provide results for human review
                  </li>
                </ol>
              </div>
            </section>
          </div>

          <footer className="sticky bottom-0 z-10 box-border flex h-auto min-h-0 flex-col-reverse gap-4 border-t border-border bg-card/98 px-4 py-4 backdrop-blur-sm sm:h-[79px] sm:flex-row sm:items-center sm:justify-end sm:py-[15px]">
            <RunDialog />
            <Dialog onOpenChange={(open) => !open && setTicketPrepared(false)}>
              <DialogTrigger asChild>
                <Button variant="outline" size="lg" className="h-12 w-[177px] rounded-md">
                  <IconTicket data-icon="inline-start" aria-hidden />
                  Prepare ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {ticketPrepared ? "Ticket draft prepared" : "Prepare support ticket"}
                  </DialogTitle>
                  <DialogDescription>
                    This creates a local fixture draft only. Nothing is sent to an external system.
                  </DialogDescription>
                </DialogHeader>
                {ticketPrepared ? (
                  <div className="rounded-md border border-success/45 bg-success/[0.055] p-4 text-sm">
                    <p className="font-semibold text-success-ink">
                      Draft TKT-2048 is ready for review.
                    </p>
                    <p className="mt-2 leading-6 text-muted-foreground">
                      The draft includes the run ID, evidence links, owner, uncertainty, and the
                      safe recovery recommendation.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-semibold" htmlFor="ticket-summary">
                      Summary
                    </label>
                    <textarea
                      id="ticket-summary"
                      defaultValue="DEV runtime validation failed because the secret reference does not match the declared runtime key."
                      className="min-h-28 resize-y rounded-md border border-input bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button type="button" size="lg" onClick={() => setTicketPrepared(true)}>
                      Prepare local draft
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Button
              size="lg"
              nativeButton={false}
              render={<Link to="/prototype/codex/diagnosis" />}
              className="h-12 w-[244px] rounded-md"
            >
              Review safe recovery
              <IconArrowRight data-icon="inline-end" aria-hidden />
            </Button>
          </footer>
        </PrototypePanel>
      </div>
    </div>
  );
}

function RunDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="h-12 w-[154px] rounded-md">
          <IconExternalLink data-icon="inline-start" aria-hidden />
          View run
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Run RUN-7f3b1a9c</DialogTitle>
          <DialogDescription>
            Fixture execution evidence from the first DEV deployment attempt.
          </DialogDescription>
        </DialogHeader>
        <ol className="overflow-hidden rounded-md border border-border">
          {RUN_TIMELINE.map((step, index) => (
            <li
              key={step.id}
              className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_minmax(0,1fr)_60px] sm:items-center"
            >
              <span className="text-sm font-semibold">{step.label}</span>
              <span className="text-sm text-muted-foreground">{step.detail}</span>
              <span className="text-xs tabular-nums text-muted-foreground sm:text-right">
                {step.duration}
              </span>
              {index < RUN_TIMELINE.length - 1 ? (
                <span className="sm:col-span-3 -mx-4 mt-2 h-px bg-border" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
