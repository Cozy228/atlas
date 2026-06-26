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
  IconListCheck,
  IconRoute,
  IconSitemap,
  IconTool,
} from "@tabler/icons-react";
import type { Icon } from "@tabler/icons-react";
import type { Source } from "@atlas/schema";

import { AuthorityBadge, FreshnessIndicator } from "@/components/evidence/badges";
import { Badge } from "@/components/ui/badge";
import type { Guidance, GuidanceAction, GuidanceStep, GuidanceType } from "@/lib/guidance";
import { taskKey, type GuidanceProgress } from "@/lib/guidance-progress";
import { cn } from "@/lib/utils";

export const TYPE_META: Record<GuidanceType, { icon: Icon; label: string }> = {
  route: { icon: IconRoute, label: "Route" },
  decision: { icon: IconSitemap, label: "Decision" },
  checklist: { icon: IconListCheck, label: "Checklist" },
};

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

/** Steps that count toward completion (everything but the destination). */
export function completableSteps(guidance: Guidance): ReadonlyArray<GuidanceStep> {
  return guidance.steps.filter((step) => step.kind !== "destination");
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
              onClick={() => progress.toggleTask(key)}
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
                  <AuthorityBadge level={source.authority_level} />
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
 * Step support / marker notes
 * ========================================================================== */

export function stepSupport(
  guidance: Guidance,
  step: GuidanceStep,
): { team: string; channel: string } {
  return step.support ?? { team: guidance.owner.team, channel: guidance.owner.support };
}

export function MarkerNote({
  marker,
  support,
}: {
  marker: "blocked" | "needs_support";
  support: { team: string; channel: string };
}) {
  const isBlocked = marker === "blocked";
  return (
    <div
      className={cn(
        "rounded-[4px] border px-3.5 py-2.5 text-xs",
        isBlocked ? "border-critical/40 bg-critical/10" : "border-warning/40 bg-warning/10",
      )}
    >
      <p className="font-semibold text-foreground">
        {isBlocked ? "This step is blocked." : "This step may need support."}
      </p>
      <p className="mt-0.5 text-muted-foreground">
        Reach {support.team} on <span className="font-mono">{support.channel}</span> before
        continuing.
      </p>
    </div>
  );
}

/** Quiet "mark complete" toggle shared by the detail directions. */
export function MarkStepButton({
  step,
  progress,
}: {
  step: GuidanceStep;
  progress: GuidanceProgress;
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
          : "bg-primary text-primary-foreground hover:bg-primary/90",
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

/** Branch options of a decision step (orientation, not navigation). */
export function DecisionOptions({ step }: { step: GuidanceStep }) {
  if (!step.options || step.options.length === 0) return null;
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {step.options.map((option) => (
        <div key={option.id} className="rounded-[4px] border border-border bg-card p-3.5">
          <p className="text-[13px] font-bold text-foreground">{option.title}</p>
          {option.description ? (
            <p className="mt-1 text-[12px] leading-[1.5] text-muted-foreground">
              {option.description}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
