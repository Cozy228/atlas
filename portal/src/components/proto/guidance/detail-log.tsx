/**
 * PROTOTYPE (production candidate) — Guidance detail "Journey log"
 * (pairs with the "Departures board" index).
 *
 * A single scrolling DOCUMENT: every station of the journey is visible down
 * one column with a continuous spine on the left — number nodes, check marks
 * as you complete, the destination flag at the end. Tasks, branch options,
 * and evidence sit inline under each station; progress lives in the header.
 * The register follows how Stripe quickstarts and Atlassian plays actually
 * read: scroll, don't navigate.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowLeft, IconCheck, IconCircleCheck, IconFlag } from "@tabler/icons-react";
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

export function GuidanceDetailLog({
  guidance,
  sources,
}: {
  guidance: Guidance;
  sources: ReadonlyArray<Source>;
}) {
  const progress = useGuidanceProgress(guidance.id);
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  const steps = completableSteps(guidance);
  const allDone = steps.length > 0 && steps.every((s) => progress.completedSteps.has(s.id));

  // Resume: the first incomplete station. On open we glide to it (smooth, once)
  // and leave a brief calm tint so the eye lands without being yanked there.
  const resumeId = steps.find((s) => !progress.completedSteps.has(s.id))?.id ?? null;
  const stationRefs = useRef(new Map<string, HTMLLIElement>());
  const didScroll = useRef(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    if (!progress.hydrated || didScroll.current) return;
    didScroll.current = true;
    if (!resumeId) return;
    const idx = guidance.steps.findIndex((s) => s.id === resumeId);
    if (idx <= 0) return; // already at the top — nothing to glide past
    const el = stationRefs.current.get(resumeId);
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      setHighlightId(resumeId);
      window.setTimeout(() => setHighlightId(null), 1500);
    });
  }, [progress.hydrated, resumeId, guidance.steps]);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8">
      <Link
        to="/proto/guidance"
        className="inline-flex w-fit items-center gap-1.5 bg-background text-[13px] font-semibold text-muted-foreground hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconArrowLeft aria-hidden className="size-3.5" />
        All guidance
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-background font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {guidance.scenario.replace(/_/g, " ")}
          </span>
          <span className="rounded-[2px] border border-border-strong px-1.5 py-0.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {FLOW_SHAPE[guidance.type]}
          </span>
          <GuidanceStatusBadge status={guidance.status} />
        </div>
        <h1 className="w-fit bg-background text-[1.75rem] font-bold leading-[1.15] tracking-[-0.025em] text-foreground">
          {guidance.title}
        </h1>
        <p className="w-fit max-w-[64ch] bg-background text-[14px] leading-[1.6] text-muted-foreground">
          {guidance.objective}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="flex items-center gap-2 rounded-[4px] border border-border bg-card px-3 py-2 text-xs">
            <IconFlag aria-hidden className="size-3.5 shrink-0 text-primary" />
            <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Destination
            </span>
            <span className="font-semibold text-foreground">{guidance.destination.title}</span>
          </span>
          <ProgressStrip guidance={guidance} progress={progress} />
        </div>
      </header>

      <ol className="flex flex-col">
        {guidance.steps.map((step, index) => (
          <Station
            key={step.id}
            guidance={guidance}
            step={step}
            index={index}
            isLast={index === guidance.steps.length - 1}
            sourceMap={sourceMap}
            progress={progress}
            allDone={allDone}
            highlight={highlightId === step.id}
            registerRef={(el) => {
              if (el) stationRefs.current.set(step.id, el);
              else stationRefs.current.delete(step.id);
            }}
          />
        ))}
      </ol>
    </div>
  );
}

function Station({
  guidance,
  step,
  index,
  isLast,
  sourceMap,
  progress,
  allDone,
  highlight,
  registerRef,
}: {
  guidance: Guidance;
  step: GuidanceStep;
  index: number;
  isLast: boolean;
  sourceMap: ReadonlyMap<string, Source>;
  progress: GuidanceProgress;
  allDone: boolean;
  highlight: boolean;
  registerRef: (el: HTMLLIElement | null) => void;
}) {
  const isDestination = step.kind === "destination";
  const done = isDestination ? allDone : progress.completedSteps.has(step.id);

  return (
    <li
      ref={registerRef}
      className={cn(
        "-mx-3 flex scroll-mt-24 gap-4 rounded-[6px] px-3 transition-colors duration-1000 sm:gap-5",
        highlight && "bg-brand-tint/30 duration-300",
      )}
    >
      {/* Spine: node + connecting line */}
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold",
            done
              ? "border-success bg-success text-success-foreground"
              : isDestination
                ? "border-primary bg-brand-tint text-primary"
                : step.marker === "blocked"
                  ? "border-critical bg-critical/10 text-critical-ink"
                  : step.marker === "needs_support"
                    ? "border-warning bg-warning/10 text-warning-ink"
                    : "border-border-strong bg-card text-muted-foreground",
          )}
        >
          {done ? (
            <IconCheck className="size-3.5" strokeWidth={3} />
          ) : isDestination ? (
            "★"
          ) : (
            index + 1
          )}
        </span>
        {!isLast ? (
          <span aria-hidden className={cn("w-px flex-1", done ? "bg-success/40" : "bg-border")} />
        ) : null}
      </div>

      {/* Station content */}
      <div className={cn("flex min-w-0 flex-1 flex-col gap-4", !isLast && "pb-10")}>
        {isDestination ? (
          <DestinationPanel guidance={guidance} step={step} allDone={allDone} />
        ) : (
          <>
            <div className="flex flex-col gap-1.5 pt-0.5">
              <span className="bg-background font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                {step.marker ? step.marker.replace("_", " ") : step.kind}
              </span>
              <h2 className="w-fit bg-background text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
                {step.title}
              </h2>
              {step.description ? (
                <p className="w-fit max-w-[62ch] bg-background text-[13.5px] leading-[1.55] text-muted-foreground">
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

            {step.marker ? (
              <MarkerNote marker={step.marker} support={stepSupport(guidance, step)} />
            ) : null}
            <DecisionOptions step={step} />
            <TaskChecklist step={step} progress={progress} />
            {step.sources && step.sources.length > 0 ? (
              <EvidenceRows sourceIds={step.sources} sourceMap={sourceMap} />
            ) : null}
            <div>
              <MarkStepButton step={step} progress={progress} />
            </div>
          </>
        )}
      </div>
    </li>
  );
}

function DestinationPanel({
  guidance,
  step,
  allDone,
}: {
  guidance: Guidance;
  step: GuidanceStep;
  allDone: boolean;
}) {
  return (
    <section className="flex flex-col gap-2.5 rounded-[4px] border border-primary/30 bg-brand-tint/40 p-5">
      <div className="flex items-center gap-2">
        <IconCircleCheck
          aria-hidden
          className={cn("size-5", allDone ? "text-success" : "text-primary")}
        />
        <h2 className="text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
          {step.title}
        </h2>
      </div>
      {step.description ? (
        <p className="max-w-[62ch] text-[13.5px] leading-[1.55] text-muted-foreground">
          {step.description}
        </p>
      ) : null}
      <p className="text-[12.5px] text-muted-foreground">
        {guidance.destination.description ?? guidance.destination.title}
      </p>
      {allDone ? (
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-success-ink">
          <IconCheck aria-hidden className="size-4" strokeWidth={3} />
          All steps marked complete.
        </p>
      ) : null}
      <p className="border-t border-primary/20 pt-2.5 text-[12px] text-muted-foreground">
        Need help? {guidance.owner.team} ·{" "}
        <span className="font-mono">{guidance.owner.support}</span>
      </p>
    </section>
  );
}
