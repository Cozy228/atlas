/**
 * Prototype "kimi" — Diagnosis.
 *
 * Product goal: explain a failed onboarding or delivery step with evidence.
 * The page resolves context (application + environment + failed run), ranks
 * hypotheses like a differential diagnosis (confidence, supporting and
 * contradicting evidence, unknowns), names owners, and offers safe recovery
 * options: prepare a correction draft, re-run the failed stage (simulated),
 * prepare a prefilled support ticket, or open the runbook. Atlas never
 * approves, never modifies production, and says so.
 */

import { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconBook2,
  IconCopy,
  IconFileDescription,
  IconRefresh,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import type { DiagnosisCase, Hypothesis } from "./fixtures";
import { APP_MAP, diagnosesForApp, getFixtureRun, personName, teamName } from "./fixtures";
import { createSimulatedRun } from "./run-store";
import { usePrototypeApp } from "./shell";
import {
  ConfidenceChip,
  EmptyState,
  EvidenceRow,
  KeyVal,
  Mono,
  PageHead,
  Panel,
  SectionHead,
  StatusDot,
  fmtUtc,
  timeAgo,
} from "./ui";

/** Deterministic ID for the next simulated support ticket. */
const SIMULATED_TICKET_ID = "REQ-105118";

export function DiagnosisPage() {
  const { appId, app } = usePrototypeApp();
  const { run: runParam } = useSearch({ from: "/prototype/kimi/diagnosis" });
  const cases = diagnosesForApp(appId);
  const selected = cases.find((c) => c.runId === runParam) ?? cases[0];

  if (!selected) {
    return (
      <div className="flex flex-col gap-5">
        <PageHead
          contour
          title="Diagnosis"
          description="Evidence-backed explanation and recovery for a failed onboarding or delivery step."
        />
        <EmptyState
          title={`No failures to diagnose for ${app.name}`}
          body="Diagnosis starts from a failed run. This application has none, which is the goal. Switch the application in the top bar to inspect another context."
          action={
            <Button
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

  return <DiagnosisDetail key={selected.runId} diagnosis={selected} />;
}

function DiagnosisDetail({ diagnosis }: { diagnosis: DiagnosisCase }) {
  const { appId, app } = usePrototypeApp();
  const navigate = useNavigate();
  const run = getFixtureRun(diagnosis.runId);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const durationSec = run?.endedAt
    ? Math.round((Date.parse(run.endedAt) - Date.parse(run.startedAt)) / 1000)
    : null;

  const activeHypotheses = diagnosis.hypotheses.filter((h) => h.confidence !== "ruled-out");
  const ruledOut = diagnosis.hypotheses.filter((h) => h.confidence === "ruled-out");
  const allUnknowns = diagnosis.hypotheses.flatMap((h) => h.unknowns);

  const correctionDraft = [
    "# Task definition revision 15 (draft)",
    "# Prepared by Atlas. Apply in Harness; Atlas does not modify source systems.",
    "secrets:",
    "-  name: DB_PASSWORD",
    "-  valueFrom: paygate/dev/db-password      # current, unresolvable",
    "+  valueFrom: paygate/dev/db/password      # matches the Vault listing",
  ].join("\n");

  const copyDraft = async () => {
    try {
      await navigator.clipboard.writeText(correctionDraft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const rerun = () => {
    const simRun = createSimulatedRun("deploy-dev", appId, {
      artifact: run?.inputs?.artifact ?? "b-1.4.7",
      environment: "dev",
      taskDefinition: "paygate:15",
    });
    void navigate({
      to: "/prototype/kimi/runs/$runId",
      params: { runId: simRun.id },
      search: { app: appId },
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        contour
        title="Diagnosis"
        description="What failed, why Atlas thinks so, what would confirm it, and the safe ways forward."
        meta={
          <Badge variant="critical">
            {diagnosis.errorClass} at {diagnosis.failedStage}
          </Badge>
        }
      />

      {/* Resolved context */}
      <Panel className="px-5 py-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          <KeyVal k="Application">
            {app.name} <Mono>{app.code}</Mono>
          </KeyVal>
          <KeyVal k="Environment">
            {app.account ? `${app.account.environment} · ${app.account.region}` : "—"}
          </KeyVal>
          <KeyVal k="Failed run">
            <Link
              to="/prototype/kimi/runs/$runId"
              params={{ runId: diagnosis.runId }}
              search={{ app: appId }}
              className="font-semibold text-brand-ink underline-offset-3 hover:underline"
            >
              {diagnosis.runId}
            </Link>
          </KeyVal>
          <KeyVal k="When">{run ? fmtUtc(run.startedAt) : "—"}</KeyVal>
          <KeyVal k="Duration">{durationSec !== null ? `${durationSec}s` : "—"}</KeyVal>
          <KeyVal k="Triggered by">{run ? personName(run.triggeredById) : "—"}</KeyVal>
        </dl>
      </Panel>

      <Panel className="px-5 py-4">
        <div className="flex items-start gap-3">
          <StatusDot tone="critical" className="mt-1.5" />
          <div>
            <p className="text-sm font-semibold text-foreground">What failed</p>
            <p className="mt-0.5 max-w-[75ch] text-[13px] leading-relaxed text-muted-foreground">
              {diagnosis.summary}
            </p>
          </div>
        </div>
      </Panel>

      {/* Ranked hypotheses */}
      <div>
        <SectionHead
          title="Likely causes, ranked"
          hint="confidence with supporting and contradicting evidence"
          className="mb-2"
        />
        <div className="flex flex-col gap-3">
          {activeHypotheses.map((hypothesis, index) => (
            <HypothesisCard key={hypothesis.id} hypothesis={hypothesis} rank={index + 1} />
          ))}
          {ruledOut.length > 0 ? (
            <Panel className="border-dashed px-5 py-4">
              <p className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                Ruled out
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {ruledOut.map((hypothesis) => (
                  <li key={hypothesis.id} className="flex flex-wrap items-center gap-2">
                    <ConfidenceChip level="ruled-out" />
                    <span className="text-[13px] font-medium text-muted-foreground">
                      {hypothesis.title}
                    </span>
                    <span className="text-xs text-muted-foreground">{hypothesis.summary}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Unknowns */}
        <div>
          <SectionHead title="Unknowns and data gaps" className="mb-2" />
          <Panel className="px-5 py-4">
            {allUnknowns.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No known blind spots for the leading hypothesis.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {allUnknowns.map((unknown) => (
                  <li key={unknown} className="flex items-start gap-2 text-[13px] text-foreground">
                    <StatusDot tone="na" className="mt-1.5" />
                    {unknown}
                  </li>
                ))}
                <li className="flex items-start gap-2 text-[13px] text-foreground">
                  <StatusDot tone="na" className="mt-1.5" />
                  The Terraform Enterprise state snapshot is {timeAgo("2026-08-13T07:20:00Z")} old,
                  so infrastructure outputs may have drifted since.
                </li>
              </ul>
            )}
          </Panel>
        </div>

        {/* Ownership */}
        <div>
          <SectionHead title="Ownership" hint="who can act on which layer" className="mb-2" />
          <Panel>
            <ul className="divide-y divide-border">
              {diagnosis.ownership.map((entry) => (
                <li
                  key={entry.layer}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="text-[13px] font-medium text-foreground">{entry.layer}</span>
                  <span className="text-xs text-muted-foreground">
                    {personName(entry.ownerId)} · {teamName(entry.teamId)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="text-[13px] font-medium text-foreground">Support route</span>
                <span className="text-xs text-muted-foreground">
                  {teamName(diagnosis.supportRoute.teamId)}, queue{" "}
                  {APP_MAP[appId] ? teamName(diagnosis.supportRoute.teamId) : ""}
                </span>
              </li>
            </ul>
            <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
              {diagnosis.supportRoute.note}
            </p>
          </Panel>
        </div>
      </div>

      {/* Recovery options */}
      <div>
        <SectionHead
          title="Safe recovery options"
          hint="Atlas prepares; humans apply"
          className="mb-2"
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {/* Correction draft */}
          <Panel className="flex flex-col gap-2 px-4 py-4">
            <IconFileDescription
              size={16}
              strokeWidth={1.8}
              aria-hidden
              className="text-muted-foreground"
            />
            <p className="text-[13px] font-semibold text-foreground">Prepare a correction draft</p>
            <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
              A ready-to-apply task definition fix for the leading hypothesis. You apply it in
              Harness; Atlas never modifies the source system.
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="self-start">
                  View draft
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Correction draft, task definition rev 15</DialogTitle>
                  <DialogDescription>
                    Prepared for you to review and apply in Harness. Atlas does not apply it.
                  </DialogDescription>
                </DialogHeader>
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/60 p-3 font-mono text-[12px] leading-relaxed">
                  {correctionDraft}
                </pre>
                <DialogFooter>
                  <Button size="sm" variant="outline" onClick={copyDraft}>
                    <IconCopy size={13} strokeWidth={2} aria-hidden />
                    {copied ? "Copied" : "Copy draft"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Panel>

          {/* Re-run */}
          <Panel className="flex flex-col gap-2 px-4 py-4">
            <IconRefresh
              size={16}
              strokeWidth={1.8}
              aria-hidden
              className="text-muted-foreground"
            />
            <p className="text-[13px] font-semibold text-foreground">Re-run the failed stage</p>
            <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
              Triggers the DEV deployment again (L3, simulated). Only sensible after the correction
              is applied in Harness.
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="self-start">
                  Re-run stage
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Re-run "Deploy to DEV"?</DialogTitle>
                  <DialogDescription>
                    This simulated run assumes the secret-path correction was applied in Harness.
                    Without it, the run will likely fail the same way. DEV only; production is out
                    of scope for this action.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button size="sm" onClick={rerun}>
                    Re-run now (simulated)
                    <IconArrowRight size={14} strokeWidth={2} aria-hidden />
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Panel>

          {/* Ticket */}
          <Panel className="flex flex-col gap-2 px-4 py-4">
            <IconFileDescription
              size={16}
              strokeWidth={1.8}
              aria-hidden
              className="text-muted-foreground"
            />
            <p className="text-[13px] font-semibold text-foreground">Prepare a support ticket</p>
            <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
              Prefilled for {teamName(diagnosis.supportRoute.teamId)} with the run, the leading
              hypothesis and its evidence attached.
            </p>
            {ticketId ? (
              <p className="text-xs font-medium text-success-ink">
                Submitted (simulated): <Mono>{ticketId}</Mono>
              </p>
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="self-start">
                    Review ticket draft
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Ticket draft, ServiceNow</DialogTitle>
                    <DialogDescription>
                      Submitted to the {teamName(diagnosis.supportRoute.teamId)} queue. A human
                      reviews it there; submitting creates no approval.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-2 text-[13px]">
                    <p className="font-semibold text-foreground">
                      Paygate DEV deployment fails at secret resolution (SecretNotFound)
                    </p>
                    <p className="text-muted-foreground">
                      Run {diagnosis.runId} failed at "{diagnosis.failedStage}". Leading hypothesis
                      (high confidence): task definition rev 14 references paygate/dev/db-password,
                      but Vault stores the secret at paygate/dev/db/password. Evidence: run error
                      line, task definition secrets block, Vault path listing (all attached).
                      Related request: REQ-105031.
                    </p>
                  </div>
                  <DialogFooter>
                    <Button size="sm" onClick={() => setTicketId(SIMULATED_TICKET_ID)}>
                      Submit request (simulated)
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </Panel>

          {/* Runbook */}
          <Panel className="flex flex-col gap-2 px-4 py-4">
            <IconBook2 size={16} strokeWidth={1.8} aria-hidden className="text-muted-foreground" />
            <p className="text-[13px] font-semibold text-foreground">Open the runbook</p>
            <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
              The golden path's documented recovery steps for secret resolution failures.
            </p>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="self-start">
                  Read runbook
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Runbook: SecretNotFound at deploy time</DialogTitle>
                  <DialogDescription>
                    Golden path {` ${"gp-aws-ecs-first-dev"}`} · v1.3.2 · owned by Cloud Foundations
                  </DialogDescription>
                </DialogHeader>
                <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px] leading-relaxed text-foreground">
                  <li>Compare the task definition's secrets block with the Vault path listing.</li>
                  <li>
                    Correct the reference in the source system and cut a new task definition
                    revision.
                  </li>
                  <li>
                    Confirm the execution role's Vault policy covers the path (request REQ-105031
                    tracks this).
                  </li>
                  <li>Re-run the failed stage in DEV and watch the "Resolve secrets" step.</li>
                  <li>
                    If it still fails, escalate to Cloud Foundations with the run ID attached.
                  </li>
                </ol>
              </DialogContent>
            </Dialog>
          </Panel>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Boundary: Atlas reads, explains, diagnoses and prepares. Approval, authorization and
          changes to infrastructure stay in the source systems with their owners.
        </p>
      </div>
    </div>
  );
}

function HypothesisCard({ hypothesis, rank }: { hypothesis: Hypothesis; rank: number }) {
  return (
    <Panel className="px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-semibold tracking-[0.06em] text-muted-foreground">
          H{rank}
        </span>
        <ConfidenceChip level={hypothesis.confidence} />
        {hypothesis.evidenceAgainst.length > 0 && hypothesis.confidence !== "ruled-out" ? (
          <Badge variant="warning">contradicted</Badge>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-foreground">{hypothesis.title}</p>
      <p className="mt-1 max-w-[80ch] text-[13px] leading-relaxed text-muted-foreground">
        {hypothesis.summary}
      </p>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.06em] text-success-ink uppercase">
            Supporting evidence
          </p>
          {hypothesis.evidenceFor.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">None.</p>
          ) : (
            <ul className="mt-1 divide-y divide-border border-t border-border">
              {hypothesis.evidenceFor.map((evidence) => (
                <EvidenceRow key={evidence.id} evidence={evidence} />
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.06em] text-critical-ink uppercase">
            Contradicting evidence
          </p>
          {hypothesis.evidenceAgainst.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">None found.</p>
          ) : (
            <ul className="mt-1 divide-y divide-border border-t border-border">
              {hypothesis.evidenceAgainst.map((evidence) => (
                <EvidenceRow key={evidence.id} evidence={evidence} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {hypothesis.unknowns.length > 0 ? (
        <div className="mt-3">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Unknowns
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {hypothesis.unknowns.map((unknown) => (
              <li key={unknown} className="flex items-start gap-2 text-xs text-foreground">
                <StatusDot tone="na" className="mt-1" />
                {unknown}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hypothesis.confirmBy ? (
        <p className={cn("mt-3 border-t border-border pt-2 text-xs text-muted-foreground")}>
          <span className="font-semibold text-foreground">Confirm by:</span> {hypothesis.confirmBy}
        </p>
      ) : null}
      {hypothesis.note ? (
        <p className="mt-1 text-xs text-muted-foreground">{hypothesis.note}</p>
      ) : null}
    </Panel>
  );
}
