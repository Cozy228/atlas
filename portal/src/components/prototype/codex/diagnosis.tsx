import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCircleCheck,
  IconCodeDots,
  IconExternalLink,
  IconHelpCircle,
  IconInfoCircle,
  IconTool,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { APP_CONTEXT, BLOCKER_EVIDENCE, RUN_TIMELINE } from "./fixtures";
import { EvidenceList, PrototypePanel } from "./ui";

type RecoveryState = "idle" | "prepared" | "ready";

export function CodexDiagnosis() {
  const [selectedEvidence, setSelectedEvidence] = useState(BLOCKER_EVIDENCE[0]!.id);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("idle");

  return (
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link to="/prototype/codex/dashboard" />}
          >
            <IconArrowLeft data-icon="inline-start" aria-hidden />
            Back to dashboard
          </Button>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-critical-ink">
            Deployment failure · RUN-7f3b1a9c
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] sm:text-3xl">
            Runtime validation failed
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Diagnosis for {APP_CONTEXT.name} in {APP_CONTEXT.environment}, based on application,
            environment, run, change, configuration, and source evidence.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="critical">Failure</Badge>
          <Badge variant="outline">Fixture evidence</Badge>
          <Badge variant="brand">Assisted diagnosis</Badge>
        </div>
      </header>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="flex min-w-0 flex-col gap-4">
          <PrototypePanel className="overflow-hidden">
            <div className="grid gap-5 border-b border-border p-5 md:grid-cols-[minmax(0,1fr)_180px] lg:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Most likely cause
                </p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.02em]">
                  Secret reference does not match the declared runtime key
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                  The service manifest declares{" "}
                  <code className="font-mono text-xs font-semibold text-foreground">
                    DB_PASSWORD
                  </code>
                  , but the deployment specification references{" "}
                  <code className="font-mono text-xs font-semibold text-foreground">DB_PASS</code>.
                  Runtime validation could not resolve the reference.
                </p>
              </div>
              <div className="rounded-md border border-critical/35 bg-critical/[0.045] p-4 md:text-right">
                <span className="text-3xl font-bold tabular-nums text-critical-ink">82%</span>
                <span className="block text-xs text-muted-foreground">confidence</span>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  Likely, not confirmed. One source remains unavailable.
                </p>
              </div>
            </div>

            <Tabs defaultValue="supporting" className="flex-col gap-0">
              <TabsList
                variant="line"
                className="h-auto w-full flex-none justify-start overflow-x-auto border-b border-border px-4 py-2 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden"
              >
                <TabsTrigger value="supporting" className="min-w-max flex-none px-3 py-2">
                  Supporting evidence · 3
                </TabsTrigger>
                <TabsTrigger value="contradicting" className="min-w-max flex-none px-3 py-2">
                  Contradicting · 0
                </TabsTrigger>
                <TabsTrigger value="unknowns" className="min-w-max flex-none px-3 py-2">
                  Unknowns · 2
                </TabsTrigger>
              </TabsList>
              <TabsContent value="supporting" className="p-4 sm:p-6">
                <EvidenceList
                  items={BLOCKER_EVIDENCE}
                  selectedId={selectedEvidence}
                  onSelect={setSelectedEvidence}
                />
              </TabsContent>
              <TabsContent value="contradicting" className="p-6">
                <div className="rounded-md border border-border bg-muted/30 px-5 py-8 text-center">
                  <IconCircleCheck className="mx-auto size-6 text-success-ink" aria-hidden />
                  <h2 className="mt-3 font-semibold">No contradicting evidence found</h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                    Atlas found no source record that disproves the key mismatch. This does not
                    raise the diagnosis to certainty because the secret source is unavailable.
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="unknowns" className="p-6">
                <ul className="overflow-hidden rounded-md border border-warning/45 bg-warning/[0.045]">
                  {[
                    "The configured secret registry is unavailable to Atlas.",
                    "The next source-system refresh has not completed.",
                  ].map((unknown, index) => (
                    <li
                      key={unknown}
                      className={cn(
                        "flex gap-3 p-4 text-sm",
                        index > 0 && "border-t border-warning/35",
                      )}
                    >
                      <IconHelpCircle
                        className="mt-0.5 size-5 shrink-0 text-warning-ink"
                        aria-hidden
                      />
                      <span>{unknown}</span>
                    </li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </PrototypePanel>

          <PrototypePanel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold">Run timeline</h2>
              <span className="font-mono text-xs text-muted-foreground">RUN-7f3b1a9c</span>
            </div>
            <ol>
              {RUN_TIMELINE.map((step, index) => (
                <li
                  key={step.id}
                  className={cn(
                    "grid gap-1 px-5 py-3 sm:grid-cols-[170px_minmax(0,1fr)_70px] sm:items-center",
                    index > 0 && "border-t border-border",
                  )}
                >
                  <span className="font-semibold">{step.label}</span>
                  <span className="text-sm text-muted-foreground">{step.detail}</span>
                  <span className="text-xs tabular-nums text-muted-foreground sm:text-right">
                    {step.duration}
                  </span>
                </li>
              ))}
            </ol>
          </PrototypePanel>
        </div>

        <aside className="flex flex-col gap-4">
          <PrototypePanel className="p-5">
            <h2 className="font-semibold">Ownership</h2>
            <dl className="mt-4 flex flex-col gap-4 text-sm">
              <div className="border-b border-border pb-4">
                <dt className="font-semibold">{APP_CONTEXT.team}</dt>
                <dd className="mt-1 leading-6 text-muted-foreground">
                  Can correct the declaration and review the prepared recovery.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Platform Support</dt>
                <dd className="mt-1 leading-6 text-muted-foreground">
                  Owns escalation if the secret source remains unavailable.
                </dd>
              </div>
            </dl>
          </PrototypePanel>

          <PrototypePanel className="overflow-hidden">
            <div className="border-b border-border p-5">
              <div className="flex items-start gap-3">
                <IconTool className="mt-0.5 size-5 shrink-0 text-brand-ink" aria-hidden />
                <div>
                  <h2 className="font-semibold">Safe recovery</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Prepare a corrected fixture specification for human review, then observe a new
                    DEV validation run.
                  </p>
                </div>
              </div>
            </div>

            {recoveryState === "idle" ? (
              <div className="p-5">
                <ol className="flex flex-col gap-3 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="font-semibold text-foreground">1.</span>Replace DB_PASS with
                    DB_PASSWORD.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-foreground">2.</span>Present the change for
                    human review.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-semibold text-foreground">3.</span>Observe a new DEV
                    validation run.
                  </li>
                </ol>
                <Button
                  className="mt-5 w-full"
                  size="lg"
                  onClick={() => setRecoveryState("prepared")}
                >
                  Prepare corrected specification
                  <IconArrowRight data-icon="inline-end" aria-hidden />
                </Button>
              </div>
            ) : recoveryState === "prepared" ? (
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Draft change · fixture
                </p>
                <div className="mt-3 overflow-hidden rounded-md border border-border font-mono text-xs">
                  <p className="bg-critical/[0.055] px-3 py-2 text-critical-ink">
                    - secretKey: DB_PASS
                  </p>
                  <p className="border-t border-border bg-success/[0.055] px-3 py-2 text-success-ink">
                    + secretKey: DB_PASSWORD
                  </p>
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <IconInfoCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Atlas prepared this draft locally. It has not submitted, approved, or applied a
                  change.
                </p>
                <Button className="mt-5 w-full" size="lg" onClick={() => setRecoveryState("ready")}>
                  Mark ready for human review
                </Button>
              </div>
            ) : (
              <div className="p-5">
                <div className="rounded-md border border-success/45 bg-success/[0.055] p-4">
                  <IconCircleCheck className="size-6 text-success-ink" aria-hidden />
                  <h3 className="mt-3 font-semibold text-success-ink">Draft is ready</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Recovery draft FIX-2048 contains the change, evidence, owner, and validation
                    plan. A human must review it before any source-system action.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => setRecoveryState("prepared")}
                >
                  Review draft again
                </Button>
              </div>
            )}
          </PrototypePanel>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <RunDetailsDialog />
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link to="/prototype/codex/scaffolder" />}
            >
              <IconCodeDots data-icon="inline-start" aria-hidden />
              Open governed action
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function RunDetailsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <IconExternalLink data-icon="inline-start" aria-hidden />
          Run details
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Run evidence</DialogTitle>
          <DialogDescription>
            Evidence is read-only and comes from deterministic fixture sources.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[120px_1fr] gap-y-3 rounded-md border border-border p-4 text-sm">
          <dt className="text-muted-foreground">Run ID</dt>
          <dd className="font-mono font-semibold">RUN-7f3b1a9c</dd>
          <dt className="text-muted-foreground">Triggered by</dt>
          <dd>{APP_CONTEXT.owner}</dd>
          <dt className="text-muted-foreground">Started</dt>
          <dd>Aug 14, 2026 · 09:10 UTC</dd>
          <dt className="text-muted-foreground">Result</dt>
          <dd className="text-critical-ink">Runtime validation failed</dd>
          <dt className="text-muted-foreground">Source system</dt>
          <dd>Delivery platform (fixture)</dd>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
