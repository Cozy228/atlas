/**
 * Prototype "kimi" — Onboarding journey.
 *
 * Product goal: onboarding as a stateful, branching journey from application
 * identification to the first successful DEV deployment. The traverse rail
 * (stations on a dashed survey line) shows progress, blockers, external waits,
 * decisions and exception paths; the detail panel shows per-step state kind
 * (observed / derived / declared / unknown), evidence with provenance, and the
 * next useful action. Selected station lives in the `?stage=` search param so
 * direct URLs and back/forward work.
 */

import { useState } from "react";
import { Link, useSearch } from "@tanstack/react-router";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconCheck,
  IconClockPause,
  IconMinus,
  IconRefresh,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { AppId, StationState, StepState } from "./fixtures";
import {
  CURRENT_USER,
  GOLDEN_PATH,
  JOURNEYS,
  diagnosesForApp,
  personName,
  runsFor,
  teamName,
} from "./fixtures";
import { usePrototypeApp } from "./shell";
import {
  EmptyState,
  EvidenceRow,
  KindChip,
  Mono,
  PageHead,
  Panel,
  StatusDot,
  fmtUtc,
  timeAgo,
  type Tone,
} from "./ui";

const STATION_TONE: Record<StationState["status"], Tone> = {
  complete: "success",
  current: "brand",
  blocked: "warning",
  failed: "critical",
  upcoming: "na",
  skipped: "neutral",
};

const STATION_LABEL: Record<StationState["status"], string> = {
  complete: "Complete",
  current: "In progress",
  blocked: "Waiting externally",
  failed: "Failed",
  upcoming: "Upcoming",
  skipped: "Skipped",
};

function defaultStation(appId: AppId): string {
  const journey = JOURNEYS[appId];
  const active = journey.stations.find(
    (s) => s.status === "failed" || s.status === "blocked" || s.status === "current",
  );
  return (active ?? journey.stations[journey.stations.length - 1]!).stageId;
}

const STEP_ICON: Record<StepState["status"], typeof IconCheck> = {
  done: IconCheck,
  waiting: IconClockPause,
  failed: IconAlertTriangle,
  pending: IconMinus,
  skipped: IconMinus,
};

const STEP_ICON_CLASS: Record<StepState["status"], string> = {
  done: "text-success-ink",
  waiting: "text-warning-ink",
  failed: "text-critical-ink",
  pending: "text-muted-foreground",
  skipped: "text-muted-foreground",
};

export function OnboardingPage() {
  const { appId } = usePrototypeApp();
  const { stage: stageParam } = useSearch({ from: "/prototype/kimi/onboarding" });
  const journey = JOURNEYS[appId];

  const selectedId = GOLDEN_PATH.stages.some((s) => s.id === stageParam)
    ? (stageParam as string)
    : defaultStation(appId);
  const station = journey.stations.find((s) => s.stageId === selectedId)!;
  const stage = GOLDEN_PATH.stages.find((s) => s.id === selectedId)!;

  // Session-local declared confirmations (manual steps). Prototype-only state.
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const [recheckNote, setRecheckNote] = useState<string | null>(null);

  const doneCount = journey.stations.filter((s) => s.status === "complete").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        contour
        title="Onboarding journey"
        description={`${GOLDEN_PATH.name}. A journey is one stateful execution of this golden path; stations can wait on external systems, branch, or fail into a diagnosis.`}
        meta={
          <>
            <Mono>{GOLDEN_PATH.version}</Mono>
            <Badge variant="neutral">Owner: {teamName(GOLDEN_PATH.ownerTeamId)}</Badge>
            <Badge variant="outline">
              {doneCount} of {GOLDEN_PATH.stages.length} stations complete
            </Badge>
          </>
        }
      />

      {journey.completedAt ? (
        <Panel className="border-success/40 px-5 py-4">
          <div className="flex items-start gap-3">
            <StatusDot tone="success" className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Journey complete, first DEV deployment verified
              </p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Completed {fmtUtc(journey.completedAt)}. Completion is backed by evidence, not a
                checkbox:
              </p>
              <ul className="mt-2 divide-y divide-border border-t border-border">
                {(journey.completionEvidence ?? []).map((evidence) => (
                  <EvidenceRow key={evidence.id} evidence={evidence} />
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Traverse rail */}
        <nav aria-label="Journey stations" className="lg:pt-1">
          <ol className="flex gap-1 overflow-x-auto lg:relative lg:flex-col lg:gap-0 lg:pl-1">
            {GOLDEN_PATH.stages.map((s, index) => {
              const st = journey.stations.find((x) => x.stageId === s.id)!;
              const selected = s.id === selectedId;
              return (
                <li key={s.id} className="relative shrink-0 lg:shrink">
                  {/* Dashed traverse connector (desktop) */}
                  {index < GOLDEN_PATH.stages.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute top-6 left-[11px] hidden h-[calc(100%-18px)] border-l border-dashed border-(--pv-traverse) lg:block"
                    />
                  ) : null}
                  <Link
                    to="/prototype/kimi/onboarding"
                    search={{ app: appId, stage: s.id }}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-sm px-2 py-2 transition-colors lg:w-full",
                      "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected && "bg-muted",
                    )}
                  >
                    <span className="relative flex items-center justify-center">
                      <StatusDot
                        tone={STATION_TONE[st.status]}
                        className={cn(
                          "size-2.5",
                          st.status === "current" && "pv-station-current",
                          selected && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                        )}
                      />
                    </span>
                    <span className="hidden w-9 shrink-0 font-mono text-[10px] font-semibold tracking-[0.05em] text-muted-foreground sm:inline">
                      {String(s.station).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate text-[13px]",
                          st.status === "upcoming"
                            ? "text-muted-foreground"
                            : "font-medium text-foreground",
                        )}
                      >
                        {s.title}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {STATION_LABEL[st.status]}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* Station detail */}
        <Panel className="min-w-0 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] font-semibold tracking-[0.08em] text-muted-foreground">
              STN {String(stage.station).padStart(2, "0")}
            </span>
            <h2 className="text-base font-bold tracking-[-0.01em] text-foreground">
              {stage.title}
            </h2>
            <Badge
              variant={
                station.status === "complete"
                  ? "success"
                  : station.status === "failed"
                    ? "critical"
                    : station.status === "blocked"
                      ? "warning"
                      : station.status === "current"
                        ? "brand"
                        : "neutral"
              }
            >
              {STATION_LABEL[station.status]}
            </Badge>
            <span className="ml-auto text-xs text-muted-foreground">Owner: {stage.ownerRole}</span>
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">Done when: {stage.outcome}</p>
          {station.summary ? (
            <p className="mt-2 text-[13px] leading-relaxed text-foreground">{station.summary}</p>
          ) : null}

          {station.steps.length > 0 ? (
            <ul className="mt-4 flex flex-col divide-y divide-border border-t border-border">
              {station.steps.map((step) => {
                const confirmedNote = confirmed[step.id];
                const effectiveStatus = confirmedNote ? "done" : step.status;
                const StepIcon = STEP_ICON[effectiveStatus];
                return (
                  <li key={step.id} className="flex items-start gap-3 py-3">
                    <StepIcon
                      size={15}
                      strokeWidth={2}
                      aria-hidden
                      className={cn("mt-0.5 shrink-0", STEP_ICON_CLASS[effectiveStatus])}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-medium text-foreground">{step.title}</p>
                        <KindChip kind={confirmedNote ? "declared" : step.kind} />
                      </div>
                      {confirmedNote ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{confirmedNote}</p>
                      ) : step.detail ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{step.detail}</p>
                      ) : null}
                      {step.evidence && step.evidence.length > 0 ? (
                        <ul className="mt-1 divide-y divide-border">
                          {step.evidence.map((evidence) => (
                            <EvidenceRow key={evidence.id} evidence={evidence} />
                          ))}
                        </ul>
                      ) : null}
                      {step.status === "pending" && step.kind === "unknown" && !confirmedNote ? (
                        <Button
                          size="xs"
                          variant="outline"
                          className="mt-2"
                          onClick={() =>
                            setConfirmed((prev) => ({
                              ...prev,
                              [step.id]: `Declared by ${CURRENT_USER.name} in this prototype session. Atlas will verify against source control on the next projection refresh.`,
                            }))
                          }
                        >
                          I connected the repository, mark as declared
                        </Button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="Not started"
                body="This station has no observable state yet. Its steps, owners and evidence appear here once earlier stations clear."
              />
            </div>
          )}

          {station.blocker ? (
            <div className="mt-4 rounded-md border border-warning/50 bg-warning/8 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusDot tone="warning" />
                <p className="text-[13px] font-semibold text-foreground">
                  Waiting on an external system
                </p>
                <Mono>{station.blocker.ticketId}</Mono>
              </div>
              <p className="mt-1 text-[13px] text-foreground">{station.blocker.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Approver: {personName(station.blocker.waitingOnPersonId)} · waiting{" "}
                {timeAgo(station.blocker.since)} · the decision is made in the source system, Atlas
                only tracks it.
              </p>
              <p className="mt-2 text-xs text-foreground">
                <span className="font-semibold">When it clears:</span> {station.blocker.next}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    setRecheckNote(
                      "Checked the source system just now (simulated): still pending approval.",
                    )
                  }
                >
                  <IconRefresh size={12} strokeWidth={2} aria-hidden />
                  Re-check status
                </Button>
                {recheckNote ? (
                  <span className="text-xs text-muted-foreground">{recheckNote}</span>
                ) : null}
              </div>
            </div>
          ) : null}

          {station.branch ? (
            <div className="mt-4 rounded-md border border-border px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusDot tone="neutral" />
                <p className="text-[13px] font-semibold text-foreground">
                  Optional branch: {station.branch.title}
                </p>
                <Badge variant="neutral">Skipped</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {station.branch.reason} Decision declared by{" "}
                {personName(station.branch.decidedById)}.
              </p>
            </div>
          ) : null}

          {station.status === "failed" ? <FailedStationActions appId={appId} /> : null}
        </Panel>
      </div>
    </div>
  );
}

function FailedStationActions({ appId }: { appId: AppId }) {
  const failedRun = runsFor(appId).find((run) => run.status === "failed");
  const hasCase = failedRun ? diagnosesForApp(appId).some((c) => c.runId === failedRun.id) : false;
  if (!failedRun) return null;
  return (
    <div className="mt-4 rounded-md border border-critical/40 bg-critical/6 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusDot tone="critical" />
        <p className="text-[13px] font-semibold text-foreground">Exception path</p>
        <Mono>{failedRun.id}</Mono>
      </div>
      <p className="mt-1 text-[13px] text-muted-foreground">
        This station was attempted before station 5 cleared. Atlas recommends resolving the failure
        before re-running: {failedRun.error?.message}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {hasCase ? (
          <Button
            size="sm"
            render={
              <Link to="/prototype/kimi/diagnosis" search={{ app: appId, run: failedRun.id }}>
                Open diagnosis
                <IconArrowRight size={14} strokeWidth={2} aria-hidden />
              </Link>
            }
          />
        ) : null}
        <Button
          size="sm"
          variant="outline"
          render={
            <Link
              to="/prototype/kimi/runs/$runId"
              params={{ runId: failedRun.id }}
              search={{ app: appId }}
            >
              View failed run
            </Link>
          }
        />
      </div>
    </div>
  );
}
