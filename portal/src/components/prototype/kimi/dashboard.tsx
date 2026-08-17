/**
 * Prototype "kimi" — Dashboard.
 *
 * Product goal: a developer understands the current state of their work and
 * application context, what needs attention, and the next useful action.
 * Structure: context strip, next bearing (one recommended action), attention
 * queue, journey snapshot, activity and open requests. Everything derives from
 * the same fixtures that drive the other surfaces.
 */

import { Link } from "@tanstack/react-router";
import { IconArrowRight, IconCircleCheck } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { AppId, Journey, Run, StationState, Ticket } from "./fixtures";
import {
  GOLDEN_PATH,
  JOURNEYS,
  SOURCES,
  diagnosesForApp,
  freshnessOf,
  runsFor,
  teamName,
  personName,
  ticketsFor,
} from "./fixtures";
import { loadSimulatedRuns } from "./run-store";
import { usePrototypeApp } from "./shell";
import {
  EmptyState,
  KeyVal,
  Mono,
  PageHead,
  Panel,
  SectionHead,
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

const RUN_TONE: Record<Run["status"], Tone> = {
  queued: "neutral",
  running: "brand",
  "waiting-approval": "warning",
  success: "success",
  failed: "critical",
};

const RUN_STATUS_LABEL: Record<Run["status"], string> = {
  queued: "Queued",
  running: "Running",
  "waiting-approval": "Waiting for approval",
  success: "Success",
  failed: "Failed",
};

interface AttentionItem {
  id: string;
  tone: Tone;
  title: string;
  meta: string;
  ageIso: string;
  action: {
    label: string;
    to: string;
    search?: Record<string, string>;
    params?: Record<string, string>;
  };
}

/** Derive the attention queue from journey state, runs and tickets. */
function attentionItems(appId: AppId, journey: Journey): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const run of runsFor(appId)) {
    if (run.status !== "failed") continue;
    items.push({
      id: `run-${run.id}`,
      tone: "critical",
      title: `${run.action} failed`,
      meta: `${run.id} · ${run.statusLabel ?? run.error?.message ?? "see run"}`,
      ageIso: run.endedAt ?? run.startedAt,
      action: {
        label: "Open diagnosis",
        to: "/prototype/kimi/diagnosis",
        search: { app: appId, run: run.id },
      },
    });
  }

  for (const station of journey.stations) {
    if (station.blocker) {
      items.push({
        id: `blocker-${station.stageId}`,
        tone: "warning",
        title: station.blocker.title,
        meta: `${station.blocker.ticketId} · waiting on ${personName(station.blocker.waitingOnPersonId)}`,
        ageIso: station.blocker.since,
        action: {
          label: "View station",
          to: "/prototype/kimi/onboarding",
          search: { app: appId, stage: station.stageId },
        },
      });
    }
    for (const step of station.steps) {
      for (const evidence of step.evidence ?? []) {
        if (freshnessOf(evidence.retrievedAt) === "stale") {
          items.push({
            id: `stale-${evidence.id}`,
            tone: "info",
            title: `Stale source: ${evidence.label}`,
            meta: `${SOURCES[evidence.source].label} snapshot ${timeAgo(evidence.retrievedAt)} old`,
            ageIso: evidence.retrievedAt,
            action: {
              label: "View station",
              to: "/prototype/kimi/onboarding",
              search: { app: appId, stage: station.stageId },
            },
          });
        }
      }
      if (step.status === "pending" && step.kind === "unknown") {
        items.push({
          id: `unknown-${step.id}`,
          tone: "warning",
          title: step.detail ?? step.title,
          meta: "Not observable yet",
          ageIso: journey.startedAt,
          action: {
            label: "View station",
            to: "/prototype/kimi/onboarding",
            search: { app: appId, stage: station.stageId },
          },
        });
      }
    }
  }

  return items.sort((a, b) => Date.parse(b.ageIso) - Date.parse(a.ageIso));
}

/** The single next useful action, derived from journey state. */
function nextBearing(
  appId: AppId,
  journey: Journey,
): {
  title: string;
  detail: string;
  cta: { label: string; to: string; search?: Record<string, string> };
  tone: Tone;
} {
  const failedRun = runsFor(appId).find((run) => run.status === "failed");
  if (failedRun && diagnosesForApp(appId).some((c) => c.runId === failedRun.id)) {
    return {
      title: `Diagnose the failed ${failedRun.action.toLowerCase()}`,
      detail: `Run ${failedRun.id} failed at "${failedRun.error?.stage ?? "unknown stage"}". The diagnosis ranks likely causes with evidence and prepares safe recovery options.`,
      cta: {
        label: "Open diagnosis",
        to: "/prototype/kimi/diagnosis",
        search: { app: appId, run: failedRun.id },
      },
      tone: "critical",
    };
  }
  const attentionStation =
    journey.stations.find((s) => s.status === "blocked") ??
    journey.stations.find((s) => s.status === "current");
  if (attentionStation) {
    const stage = GOLDEN_PATH.stages.find((s) => s.id === attentionStation.stageId);
    return {
      title: `Continue onboarding at station ${stage?.station}: ${stage?.title}`,
      detail: attentionStation.blocker
        ? `Waiting externally: ${attentionStation.blocker.title}. ${attentionStation.blocker.next}`
        : (attentionStation.summary ?? stage?.outcome ?? ""),
      cta: {
        label: "Open onboarding",
        to: "/prototype/kimi/onboarding",
        search: { app: appId, stage: attentionStation.stageId },
      },
      tone: attentionStation.status === "blocked" ? "warning" : "brand",
    };
  }
  return {
    title: "Journey complete",
    detail:
      "The first DEV deployment is verified with evidence. Nothing on this golden path needs attention.",
    cta: {
      label: "View completion evidence",
      to: "/prototype/kimi/onboarding",
      search: { app: appId },
    },
    tone: "success",
  };
}

export function DashboardPage() {
  const { appId, app } = usePrototypeApp();
  const journey = JOURNEYS[appId];
  const runs = [...loadSimulatedRuns().filter((r) => r.appId === appId), ...runsFor(appId)];
  const tickets = ticketsFor(appId).filter((t) => t.status !== "resolved");
  const attention = attentionItems(appId, journey);
  const bearing = nextBearing(appId, journey);
  const doneStations = journey.stations.filter((s) => s.status === "complete").length;

  return (
    <div className="flex flex-col gap-5">
      <PageHead
        contour
        title={app.name}
        description={app.description}
        meta={
          <>
            <Mono>{app.code}</Mono>
            <Badge variant={journey.completedAt ? "success" : "warning"}>
              {journey.completedAt ? "Onboarding complete" : "Onboarding in progress"}
            </Badge>
          </>
        }
      />

      {/* Application context strip */}
      <Panel className="px-5 py-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
          <KeyVal k="Team">{teamName(app.teamId)}</KeyVal>
          <KeyVal k="Owner">{personName(app.ownerId)}</KeyVal>
          <KeyVal k="Repository">
            {app.repoUrl ? (
              <Mono>{app.repoUrl.replace("https://git.example.com/", "")}</Mono>
            ) : (
              <span className="text-muted-foreground">Not connected</span>
            )}
          </KeyVal>
          <KeyVal k="AWS account">
            {app.account ? (
              <Mono>{app.account.id}</Mono>
            ) : (
              <span className="text-muted-foreground">Not mapped</span>
            )}
          </KeyVal>
          <KeyVal k="Region / Env">
            {app.account ? `${app.account.region} · ${app.account.environment}` : "—"}
          </KeyVal>
          <KeyVal k="Journey started">{timeAgo(journey.startedAt)} ago</KeyVal>
        </dl>
      </Panel>

      {/* Next bearing: the one recommended action */}
      <Panel className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <StatusDot tone={bearing.tone} className="mt-1.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Next bearing
            </p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{bearing.title}</p>
            <p className="mt-0.5 max-w-[68ch] text-[13px] leading-relaxed text-muted-foreground">
              {bearing.detail}
            </p>
          </div>
        </div>
        <Button
          nativeButton={false}
          size="sm"
          className="shrink-0"
          render={
            <Link to={bearing.cta.to} search={bearing.cta.search}>
              {bearing.cta.label}
              <IconArrowRight size={14} strokeWidth={2} aria-hidden />
            </Link>
          }
        />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Attention queue */}
        <div className="lg:col-span-3">
          <SectionHead
            title="Needs attention"
            hint={attention.length > 0 ? `${attention.length} open` : "clear"}
            className="mb-2"
          />
          {attention.length === 0 ? (
            <EmptyState
              icon={<IconCircleCheck size={18} strokeWidth={1.8} />}
              title="Nothing needs attention"
              body="No failures, external waits or stale sources for this application. New blockers and failed runs will surface here with their owner and age."
            />
          ) : (
            <Panel>
              <ul className="divide-y divide-border">
                {attention.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                    <StatusDot tone={item.tone} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">
                        {item.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {timeAgo(item.ageIso)}
                    </span>
                    <Link
                      to={item.action.to}
                      search={item.action.search}
                      className="shrink-0 rounded-sm px-1.5 py-1 text-xs font-semibold text-brand-ink underline-offset-3 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {item.action.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        {/* Journey snapshot */}
        <div className="lg:col-span-2">
          <SectionHead
            title="Journey"
            hint={`${doneStations} of ${GOLDEN_PATH.stages.length} stations complete`}
            className="mb-2"
          />
          <Panel className="px-4 py-3">
            <ol className="flex flex-col gap-1">
              {GOLDEN_PATH.stages.map((stage) => {
                const station = journey.stations.find((s) => s.stageId === stage.id);
                const status = station?.status ?? "upcoming";
                return (
                  <li key={stage.id}>
                    <Link
                      to="/prototype/kimi/onboarding"
                      search={{ app: appId, stage: stage.id }}
                      className="group flex items-center gap-3 rounded-sm px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <StatusDot tone={STATION_TONE[status]} />
                      <span className="w-10 shrink-0 font-mono text-[10px] font-semibold tracking-[0.05em] text-muted-foreground">
                        STN {String(stage.station).padStart(2, "0")}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-[13px]",
                          status === "upcoming"
                            ? "text-muted-foreground"
                            : "font-medium text-foreground",
                        )}
                      >
                        {stage.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground capitalize">
                        {status}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Activity */}
        <div className="lg:col-span-3">
          <SectionHead title="Activity" hint="action runs, newest first" className="mb-2" />
          {runs.length === 0 ? (
            <EmptyState
              title="No runs yet"
              body="No action has run for this application. Trigger one from the scaffolder and its progress, outcome and evidence will appear here and on the run page."
              action={
                <Button
                  nativeButton={false}
                  size="sm"
                  variant="outline"
                  render={
                    <Link to="/prototype/kimi/scaffolder" search={{ app: appId }}>
                      Open scaffolder
                    </Link>
                  }
                />
              }
            />
          ) : (
            <Panel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] tracking-[0.06em] uppercase">Run</TableHead>
                    <TableHead className="text-[11px] tracking-[0.06em] uppercase">
                      Action
                    </TableHead>
                    <TableHead className="text-[11px] tracking-[0.06em] uppercase">
                      System
                    </TableHead>
                    <TableHead className="text-[11px] tracking-[0.06em] uppercase">
                      Status
                    </TableHead>
                    <TableHead className="text-right text-[11px] tracking-[0.06em] uppercase">
                      Started
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <Link
                          to="/prototype/kimi/runs/$runId"
                          params={{ runId: run.id }}
                          search={{ app: appId }}
                          className="rounded-sm font-semibold text-brand-ink underline-offset-3 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {run.id}
                        </Link>
                        {run.simulated ? (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">sim</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{run.action}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {SOURCES[run.targetSystem].label}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <StatusDot tone={RUN_TONE[run.status]} />
                          <span className="text-[13px]">{RUN_STATUS_LABEL[run.status]}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {fmtUtc(run.startedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          )}
        </div>

        {/* Open requests */}
        <div className="lg:col-span-2">
          <SectionHead
            title="Open requests"
            hint="external systems own approval"
            className="mb-2"
          />
          {tickets.length === 0 ? (
            <EmptyState
              title="No open requests"
              body="Access and policy requests for this application are all resolved. New requests appear here with their waiting time and approver."
            />
          ) : (
            <Panel>
              <ul className="divide-y divide-border">
                {tickets.map((ticket: Ticket) => (
                  <li key={ticket.id} className="flex flex-col gap-1 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Mono>{ticket.id}</Mono>
                      <span className="text-[11px] tabular-nums text-warning-ink">
                        waiting {timeAgo(ticket.openedAt)}
                      </span>
                    </div>
                    <p className="text-[13px] leading-snug text-foreground">{ticket.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {SOURCES[ticket.system].label}
                      {ticket.waitingOnId ? ` · approver ${personName(ticket.waitingOnId)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
