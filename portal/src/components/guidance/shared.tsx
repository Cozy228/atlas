/**
 * shared vocabulary for the
 * `/guidance` index + detail directions: type metadata, status chips,
 * progress strip, task checklist, and evidence rows. The journey/destination
 * vocabulary carries across all three families.
 */
import { Link } from "@tanstack/react-router";
import {
  IconArrowUpRight,
  IconCheck,
  IconCopy,
  IconFileText,
  IconFlagFilled,
  IconLifebuoy,
  IconTool,
} from "@tabler/icons-react";
import type { Source } from "@atlas/schema";

import { FreshnessIndicator } from "@/components/evidence/badges";
import { Badge } from "@/components/ui/badge";
import type { Guidance, GuidanceAction, GuidanceStep } from "@/lib/guidance";
import { taskKey, type GuidanceProgress } from "@/lib/guidance-progress";
import { cn } from "@/lib/utils";

export const STATUS_CHIP: Record<
  Guidance["status"],
  { variant: "success" | "neutral" | "warning" | "critical"; label: string } | null
> = {
  published: null, // published is the normal state; no chip noise
  draft: { variant: "neutral", label: "Draft" },
  needs_review: { variant: "warning", label: "Needs review" },
  deprecated: { variant: "critical", label: "Deprecated" },
};

export function GuidanceStatusBadge({ status }: { status: Guidance["status"] }) {
  const chip = STATUS_CHIP[status];
  if (!chip) return null;
  return (
    <Badge variant={chip.variant} className="shrink-0 whitespace-nowrap">
      {chip.label}
    </Badge>
  );
}

/** Steps that count toward completion (every step of the linear journey). */
export function completableSteps(guidance: Guidance): ReadonlyArray<GuidanceStep> {
  return guidance.steps;
}

export function DestinationFlag({ title, className }: { title: string; className?: string }) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground",
        className,
      )}
    >
      <IconFlagFilled aria-hidden className="size-3 shrink-0 text-success" />
      <span className="truncate">{title}</span>
    </span>
  );
}

/* ========================================================================== *
 * Progress strip — count + bar + reset (shared by every detail direction)
 * ========================================================================== */

export function ProgressStrip({
  guidance,
  progress,
}: {
  guidance: Guidance;
  progress: GuidanceProgress;
}) {
  const steps = completableSteps(guidance);
  const done = steps.filter((step) => progress.completedSteps.has(step.id)).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 w-28 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={done}
        aria-label="Steps complete"
      >
        <span
          className="block h-full rounded-full bg-success transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {done} / {steps.length} steps
      </span>
      {done > 0 ? (
        <button
          type="button"
          onClick={progress.reset}
          className="rounded-sm font-mono text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Reset
        </button>
      ) : null}
    </div>
  );
}

/* ========================================================================== *
 * Task checklist — checkbox rows with the step's actions inline
 * ========================================================================== */

export function TaskChecklist({
  step,
  progress,
}: {
  step: GuidanceStep;
  progress: GuidanceProgress;
}) {
  const tasks = step.tasks ?? [];
  if (tasks.length === 0) return null;
  const allKeys = tasks.map((task) => taskKey(step.id, task.id));
  // Tasks drive the step: toggling one keeps the step's completion in sync —
  // all checked auto-completes it, unchecking any reverts it. (The Mark button
  // stays an independent manual toggle for steps without tasks.)
  const toggleTaskAndStep = (key: string) => {
    progress.toggleTask(key);
    const willAllBeDone = allKeys.every((k) =>
      k === key ? !progress.completedTasks.has(k) : progress.completedTasks.has(k),
    );
    if (willAllBeDone !== progress.completedSteps.has(step.id)) progress.toggleStep(step.id);
  };
  return (
    <ul className="flex flex-col divide-y divide-border rounded-[4px] border border-border bg-card">
      {tasks.map((task) => {
        const key = taskKey(step.id, task.id);
        const done = progress.completedTasks.has(key);
        return (
          <li
            key={task.id}
            className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={done}
              onClick={() => toggleTaskAndStep(key)}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                  done
                    ? "border-success bg-success text-success-foreground"
                    : "border-border-strong bg-card text-transparent",
                )}
              >
                <IconCheck className="size-3" strokeWidth={3} />
              </span>
              <span
                className={cn(
                  "min-w-0 text-[13px]",
                  done ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                {task.title}
              </span>
              {task.required ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                  required
                </span>
              ) : null}
            </button>
            {task.action ? <ActionControl action={task.action} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

/* ========================================================================== *
 * Evidence rows — the step's sources with authority + freshness
 * ========================================================================== */

export function EvidenceRows({
  sourceIds,
  sourceMap,
}: {
  sourceIds: ReadonlyArray<string>;
  sourceMap: ReadonlyMap<string, Source>;
}) {
  if (sourceIds.length === 0) return null;
  return (
    <ul className="flex flex-col divide-y divide-border border-t border-border">
      {sourceIds.map((sourceId) => {
        const source = sourceMap.get(sourceId);
        return (
          <li key={sourceId} className="flex flex-wrap items-center justify-between gap-2 py-2">
            {source ? (
              <>
                <Link
                  to="/sources/$sourceId"
                  params={{ sourceId: source.id }}
                  className="text-[12.5px] font-semibold text-foreground hover:text-brand-ink"
                >
                  {source.title}
                </Link>
                <span className="flex items-center gap-1.5">
                  <FreshnessIndicator source={source} />
                </span>
              </>
            ) : (
              <span className="font-mono text-[11px] text-muted-foreground">{sourceId}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ========================================================================== *
 * Mark-complete control
 * ========================================================================== */

/**
 * "Mark complete" toggle shared by the detail directions. Only the current step
 * (the first incomplete one) wears the primary brand fill — the rest are quiet
 * outlines, so the page has a single obvious call to action at a time.
 */
export function MarkStepButton({
  step,
  progress,
  isCurrent = false,
}: {
  step: GuidanceStep;
  progress: GuidanceProgress;
  isCurrent?: boolean;
}) {
  const done = progress.completedSteps.has(step.id);
  return (
    <button
      type="button"
      aria-pressed={done}
      onClick={() => progress.toggleStep(step.id)}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[3px] px-3 py-1.5 text-xs font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        done
          ? "border border-success/40 bg-success/10 text-success-ink hover:bg-success/15"
          : isCurrent
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border border-border bg-card text-foreground hover:border-border-strong hover:bg-muted",
      )}
    >
      <IconCheck className="size-3.5" strokeWidth={3} aria-hidden />
      {done ? "Step complete" : "Mark step complete"}
    </button>
  );
}

/* ========================================================================== *
 * Task action control — verb-rule buttons (Open / View / Copy / Contact)
 * ========================================================================== */

const ACTION_ICON = {
  external_link: IconArrowUpRight,
  tool_link: IconTool,
  support_link: IconLifebuoy,
  source_link: IconFileText,
} as const;

const PRIMARY_BTN = cn(
  "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors",
  "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

const SECONDARY_BTN = cn(
  "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors",
  "hover:bg-muted hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

/** Renders a single task action following the design's verb rules (Open/View/Copy/Contact). */
export function ActionControl({
  action,
  primary = false,
}: {
  action: GuidanceAction;
  primary?: boolean;
}) {
  const cls = primary ? PRIMARY_BTN : SECONDARY_BTN;

  if (action.type === "copy_text") {
    return (
      <button
        type="button"
        className={cls}
        onClick={() => void navigator.clipboard?.writeText(action.text ?? "")}
      >
        <IconCopy className="size-3.5" aria-hidden />
        {action.label}
      </button>
    );
  }

  if (action.type === "source_link" && action.ref) {
    return (
      <Link to="/sources/$sourceId" params={{ sourceId: action.ref }} className={cls}>
        <IconFileText className="size-3.5" aria-hidden />
        {action.label}
      </Link>
    );
  }

  if (action.type === "atlas_page" && action.target) {
    return (
      <Link to={action.target as never} className={cls}>
        {action.label}
      </Link>
    );
  }

  const Icon = ACTION_ICON[action.type as keyof typeof ACTION_ICON] ?? IconArrowUpRight;
  return (
    <a href={action.target ?? "#"} target="_blank" rel="noreferrer noopener" className={cls}>
      <Icon className="size-3.5" aria-hidden />
      {action.label}
    </a>
  );
}
