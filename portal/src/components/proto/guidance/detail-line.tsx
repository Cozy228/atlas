/**
 * PROTOTYPE (production candidate) — Guidance detail "Track"
 * (pairs with the "Line diagram" index).
 *
 * The transit register carried into the workspace: the full TRACK runs
 * horizontally across the top — every station a labelled, clickable node
 * (ticked when complete, flag at the terminus) — and the platform below
 * shows the CURRENT STATION: description, branch options, checklist, with
 * evidence and support in a side bay. You always see the whole line while
 * standing at one station.
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowLeft, IconArrowRight, IconCheck, IconFlagFilled } from "@tabler/icons-react";
import type { Source } from "@atlas/schema";

import type { Guidance, GuidanceStep } from "@/lib/guidance";
import { useGuidanceProgress, type GuidanceProgress } from "@/lib/guidance-progress";
import { cn } from "@/lib/utils";

import { FLOW_SHAPE } from "./catalog";
import {
  DecisionOptions,
  EvidenceRows,
  GuidanceStatusBadge,
  MarkStepButton,
  MarkerNote,
  ProgressStrip,
  TaskChecklist,
  completableSteps,
  stepSupport,
} from "./shared";

export function GuidanceDetailLine({
  guidance,
  sources,
  selectedStepId,
}: {
  guidance: Guidance;
  sources: ReadonlyArray<Source>;
  selectedStepId: string;
}) {
  const progress = useGuidanceProgress(guidance.id);
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const index = Math.max(
    0,
    guidance.steps.findIndex((step) => step.id === selectedStepId),
  );
  const step = guidance.steps[index]!;
  const next = guidance.steps[index + 1];
  const steps = completableSteps(guidance);
  const allDone = steps.length > 0 && steps.every((s) => progress.completedSteps.has(s.id));

  return (
    <div className="mx-auto flex w-full max-w-[1060px] flex-col gap-7">
      <Link
        to="/proto/guidance"
        className="inline-flex w-fit items-center gap-1.5 bg-background text-[13px] font-semibold text-muted-foreground hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconArrowLeft aria-hidden className="size-3.5" />
        All routes
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {FLOW_SHAPE[guidance.type]} · {guidance.scenario.replace(/_/g, " ")}
            </span>
            <GuidanceStatusBadge status={guidance.status} />
          </div>
          <h1 className="w-fit bg-background text-[1.625rem] font-bold leading-[1.15] tracking-[-0.025em] text-foreground">
            {guidance.title}
          </h1>
          <span className="flex items-center gap-1.5 bg-background text-[12.5px] text-muted-foreground">
            <IconFlagFilled aria-hidden className="size-3 shrink-0 text-success" />
            Terminus: <span className="font-semibold text-foreground">{guidance.destination.title}</span>
          </span>
        </div>
        <ProgressStrip guidance={guidance} progress={progress} />
      </header>

      <Track guidance={guidance} currentIndex={index} progress={progress} allDone={allDone} />

      <StationPlatform
        guidance={guidance}
        step={step}
        index={index}
        next={next}
        sourceMap={sourceMap}
        progress={progress}
        allDone={allDone}
      />
    </div>
  );
}

/* ========================================================================== *
 * Track — the whole line, horizontal, labels under the nodes
 * ========================================================================== */

function Track({
  guidance,
  currentIndex,
  progress,
  allDone,
}: {
  guidance: Guidance;
  currentIndex: number;
  progress: GuidanceProgress;
  allDone: boolean;
}) {
  return (
    <nav aria-label="Stations" className="overflow-x-auto rounded-[4px] border border-border bg-card px-6 py-4">
      <ol className="relative flex min-w-max items-start">
        {guidance.steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDestination = step.kind === "destination";
          const done = isDestination ? allDone : progress.completedSteps.has(step.id);
          const isLast = index === guidance.steps.length - 1;
          return (
            <li key={step.id} className="flex items-start">
              <Link
                to="/proto/guidance/$guidanceId"
                params={{ guidanceId: guidance.id }}
                search={{ variant: "line", step: step.id }}
                aria-current={isCurrent ? "step" : undefined}
                className="group flex w-[108px] flex-col items-center gap-2 rounded-[3px] py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border-[1.5px] bg-card font-mono text-[10px] font-bold transition-shadow",
                    done
                      ? "border-success bg-success text-success-foreground"
                      : isDestination
                        ? "border-success text-success"
                        : "border-border-strong text-muted-foreground",
                    isCurrent && "ring-2 ring-ring ring-offset-2 ring-offset-card",
                  )}
                >
                  {done ? (
                    <IconCheck className="size-3" strokeWidth={3} />
                  ) : isDestination ? (
                    <IconFlagFilled className="size-2.5" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "max-w-full truncate px-1 text-center text-[11px] leading-[1.3]",
                    isCurrent ? "font-bold text-brand-ink" : "text-muted-foreground group-hover:text-foreground",
                  )}
                >
                  {step.title}
                </span>
              </Link>
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn("mt-[15px] h-px w-10 shrink-0", done ? "bg-success/50" : "bg-border-strong")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ========================================================================== *
 * Station platform — current station content + side bay
 * ========================================================================== */

function StationPlatform({
  guidance,
  step,
  index,
  next,
  sourceMap,
  progress,
  allDone,
}: {
  guidance: Guidance;
  step: GuidanceStep;
  index: number;
  next?: GuidanceStep;
  sourceMap: ReadonlyMap<string, Source>;
  progress: GuidanceProgress;
  allDone: boolean;
}) {
  const isDestination = step.kind === "destination";
  const support = stepSupport(guidance, step);

  return (
    <div className="grid items-start gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,1fr)_280px]">
      <main className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span className="bg-background font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {isDestination
              ? "Terminus"
              : `Station ${index + 1} · ${step.marker ? step.marker.replace("_", " ") : step.kind}`}
          </span>
          <h2 className="w-fit bg-background text-[1.25rem] font-bold tracking-[-0.02em] text-foreground">
            {step.title}
          </h2>
          {step.description ? (
            <p className="w-fit max-w-[62ch] bg-background text-[14px] leading-[1.6] text-muted-foreground">
              {step.description}
            </p>
          ) : null}
          {step.why ? (
            <p className="w-fit max-w-[62ch] bg-background text-[12.5px] leading-[1.55] text-muted-foreground">
              <span className="font-semibold text-foreground/80">Why it matters: </span>
              {step.why}
            </p>
          ) : null}
        </div>

        {step.marker ? <MarkerNote marker={step.marker} support={support} /> : null}
        <DecisionOptions step={step} />
        <TaskChecklist step={step} progress={progress} />

        {isDestination ? (
          <p
            className={cn(
              "flex items-center gap-1.5 rounded-[4px] border px-4 py-3 text-[13px]",
              allDone
                ? "border-success/40 bg-success/10 font-semibold text-success-ink"
                : "border-border bg-card text-muted-foreground",
            )}
          >
            {allDone ? (
              <>
                <IconCheck aria-hidden className="size-4" strokeWidth={3} />
                All stations complete. {guidance.destination.description ?? ""}
              </>
            ) : (
              <>{guidance.destination.description ?? guidance.destination.title}</>
            )}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <MarkStepButton step={step} progress={progress} />
            {next ? (
              <Link
                to="/proto/guidance/$guidanceId"
                params={{ guidanceId: guidance.id }}
                search={{ variant: "line", step: next.id }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[3px] border border-border bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition-colors",
                  "hover:border-border-strong hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                Next station: {next.title}
                <IconArrowRight aria-hidden className="size-3.5" />
              </Link>
            ) : null}
          </div>
        )}
      </main>

      <aside className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-[72px]">
        {step.sources && step.sources.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h3 className="w-fit bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Evidence
            </h3>
            <EvidenceRows sourceIds={step.sources} sourceMap={sourceMap} />
          </section>
        ) : null}
        <section className="flex flex-col gap-2">
          <h3 className="w-fit bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Need help?
          </h3>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[4px] border border-border bg-card px-4 py-3 text-xs">
            <span className="font-semibold text-foreground">{support.team}</span>
            <span className="font-mono text-muted-foreground">{support.channel}</span>
          </p>
        </section>
        <section className="flex flex-col gap-2">
          <h3 className="w-fit bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Route facts
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-[4px] border border-border bg-card px-4 py-3 text-xs">
            <dt className="text-muted-foreground">Owner</dt>
            <dd className="text-right font-semibold text-foreground">{guidance.owner.team}</dd>
            <dt className="text-muted-foreground">Version</dt>
            <dd className="text-right font-mono text-muted-foreground">v{guidance.version}</dd>
            <dt className="text-muted-foreground">Reviewed</dt>
            <dd className="text-right font-mono tabular-nums text-muted-foreground">
              {guidance.lastReviewed}
            </dd>
          </dl>
        </section>
      </aside>
    </div>
  );
}
