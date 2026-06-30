/**
 * Guidance detail "Journey log"
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

import {
  EvidenceRows,
  GuidanceStatusBadge,
  MarkStepButton,
  ProgressStrip,
  TaskChecklist,
  completableSteps,
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

  // Take scroll control from the browser while a flow is open: its load-time
  // restoration would otherwise reset us to the top right after our resume glide
  // and clobber it. Restored on unmount so other routes keep native behaviour.
  useEffect(() => {
    if (typeof history === "undefined") return;
    const previous = history.scrollRestoration;
    history.scrollRestoration = "manual";
    return () => {
      history.scrollRestoration = previous;
    };
  }, []);

  useEffect(() => {
    if (!progress.hydrated || didScroll.current) return;
    if (!resumeId) return;
    const idx = guidance.steps.findIndex((s) => s.id === resumeId);
    if (idx <= 0) return; // already at the top — nothing to glide past
    // The stations render with the component (loader data, never deferred), so the
    // ref is set by the time this effect runs; bail without burning the one-shot
    // on the off chance it isn't.
    if (!stationRefs.current.has(resumeId)) return;
    didScroll.current = true;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // A short timeout lets the first layout settle, then we read the ref fresh (the
    // list may have re-rendered as evidence streams in). setTimeout — not rAF —
    // because rAF is paused in a background tab, so a flow opened there would never
    // glide; no cleanup, so the one-shot survives StrictMode's mount/unmount probe.
    window.setTimeout(() => {
      const el = stationRefs.current.get(resumeId);
      if (!el) return;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      setHighlightId(resumeId);
      window.setTimeout(() => setHighlightId(null), 1500);
    }, 80);
  }, [progress.hydrated, resumeId, guidance.steps]);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-8">
      <Link
        to="/guidance"
        className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-muted-foreground hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <IconArrowLeft aria-hidden className="size-3.5" />
        All guidance
      </Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {guidance.scenario.replace(/_/g, " ")}
          </span>
          <GuidanceStatusBadge status={guidance.status} />
        </div>
        <h1 className="w-fit text-[1.75rem] font-bold leading-[1.15] tracking-[-0.025em] text-foreground">
          {guidance.title}
        </h1>
        <p className="w-fit max-w-[64ch] text-[14px] leading-[1.6] text-muted-foreground">
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
            step={step}
            index={index}
            sourceMap={sourceMap}
            progress={progress}
            highlight={highlightId === step.id}
            isCurrent={step.id === resumeId}
            registerRef={(el) => {
              if (el) stationRefs.current.set(step.id, el);
              else stationRefs.current.delete(step.id);
            }}
          />
        ))}
        <DestinationStation guidance={guidance} allDone={allDone} />
      </ol>
    </div>
  );
}

function Station({
  step,
  index,
  sourceMap,
  progress,
  highlight,
  isCurrent,
  registerRef,
}: {
  step: GuidanceStep;
  index: number;
  sourceMap: ReadonlyMap<string, Source>;
  progress: GuidanceProgress;
  highlight: boolean;
  isCurrent: boolean;
  registerRef: (el: HTMLLIElement | null) => void;
}) {
  const done = progress.completedSteps.has(step.id);

  return (
    <li ref={registerRef} className="flex scroll-mt-24 gap-4 sm:gap-5">
      {/* Spine: node + connecting line. pt-3 drops the node to align with the
          title inside the card's top padding; the connector then fills down
          through the gap below, so the line runs unbroken to the next station. */}
      <div className="flex flex-col items-center pt-3">
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold",
            done
              ? "border-success bg-success text-success-foreground"
              : "border-border-strong bg-card text-muted-foreground",
          )}
        >
          {done ? <IconCheck className="size-3.5" strokeWidth={3} /> : index + 1}
        </span>
        <span aria-hidden className={cn("w-px flex-1", done ? "bg-success/40" : "bg-border")} />
      </div>

      {/* Content column. pb-10 spaces to the next station and sits OUTSIDE the
          highlight card below, so the resume flash hugs the step, not the gap. */}
      <div className="flex min-w-0 flex-1 flex-col pb-10">
        <div
          className={cn(
            "-mx-3 flex flex-col gap-4 rounded-[6px] px-3 py-3 transition-[background-color,box-shadow] duration-1000",
            // Resume landing flash: a brand wash + ring, readable in light and
            // dark (brand-tint alone is too faint either way). Quick in, slow out.
            highlight && "bg-brand-tint ring-2 ring-inset ring-brand/50 duration-300",
          )}
        >
          <div className="flex flex-col gap-1.5">
            <h2 className="w-fit text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
              {step.title}
            </h2>
            {step.description ? (
              <p className="w-fit max-w-[62ch] text-[13.5px] leading-[1.55] text-muted-foreground">
                {step.description}
              </p>
            ) : null}
            {step.why ? (
              <p className="w-fit max-w-[62ch] text-[12.5px] leading-[1.55] text-muted-foreground">
                <span className="font-semibold text-foreground/80">Why it matters: </span>
                {step.why}
              </p>
            ) : null}
          </div>

          <TaskChecklist step={step} progress={progress} />
          {step.sources && step.sources.length > 0 ? (
            <EvidenceRows sourceIds={step.sources} sourceMap={sourceMap} />
          ) : null}
          <div>
            <MarkStepButton step={step} progress={progress} isCurrent={isCurrent} />
          </div>
        </div>
      </div>
    </li>
  );
}

/** The journey's end-state, rendered as the closing station from `guidance.destination`. */
function DestinationStation({ guidance, allDone }: { guidance: Guidance; allDone: boolean }) {
  return (
    <li className="-mx-3 flex scroll-mt-24 gap-4 rounded-[6px] px-3 sm:gap-5">
      <div className="flex flex-col items-center">
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px] font-bold",
            allDone
              ? "border-success bg-success text-success-foreground"
              : "border-primary bg-brand-tint text-primary",
          )}
        >
          {allDone ? <IconCheck className="size-3.5" strokeWidth={3} /> : "★"}
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <section className="flex flex-col gap-2.5 rounded-[4px] border border-primary/30 bg-brand-tint/40 p-5">
          <div className="flex items-center gap-2">
            <IconCircleCheck
              aria-hidden
              className={cn("size-5", allDone ? "text-success" : "text-primary")}
            />
            <h2 className="text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
              {guidance.destination.title}
            </h2>
          </div>
          {guidance.destination.description ? (
            <p className="max-w-[62ch] text-[13.5px] leading-[1.55] text-muted-foreground">
              {guidance.destination.description}
            </p>
          ) : null}
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
      </div>
    </li>
  );
}
