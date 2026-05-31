import { Link } from "@tanstack/react-router";
import {
  IconArrowUpRight,
  IconCopy,
  IconFileText,
  IconLifebuoy,
  IconTool,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import type { GuidanceAction, GuidanceStep, GuidanceType, StepStatus } from "@/lib/guidance";
import { stepStatus } from "@/lib/guidance";
import { cn } from "@/lib/utils";

export const GUIDANCE_TYPE_LABEL: Record<GuidanceType, string> = {
  route: "Route",
  decision: "Decision",
  checklist: "Checklist",
};

const STATUS_DOT: Record<StepStatus, string> = {
  available: "border-border-strong bg-card",
  selected: "border-primary bg-primary",
  destination: "border-primary bg-brand-tint",
  blocked: "border-critical bg-critical/15",
  needs_support: "border-warning bg-warning/15",
};

export function GuidanceTypeBadge({ type }: { type: GuidanceType }) {
  return (
    <Badge variant="outline" className="font-mono type-caption">
      {GUIDANCE_TYPE_LABEL[type]}
    </Badge>
  );
}

/**
 * Compact vertical stepper preview for index cards and related-guidance modules.
 * Orientation, not interaction — steps are not clickable here.
 */
export function StepperPreview({
  steps,
  max = 6,
}: {
  steps: ReadonlyArray<GuidanceStep>;
  max?: number;
}) {
  const visible = steps.slice(0, max);
  const overflow = steps.length - visible.length;

  return (
    <ol className="flex flex-col gap-0">
      {visible.map((step, index) => {
        const status = stepStatus(step, "");
        const isLast = index === visible.length - 1 && overflow === 0;
        return (
          <li key={step.id} className="flex items-stretch gap-2.5">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={cn("mt-1 size-2.5 shrink-0 rounded-full border", STATUS_DOT[status])}
              />
              {!isLast ? <span aria-hidden className="w-px flex-1 bg-border" /> : null}
            </div>
            <span
              className={cn(
                "truncate pb-2 type-caption",
                status === "destination"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {step.title}
            </span>
          </li>
        );
      })}
      {overflow > 0 ? (
        <li className="flex items-center gap-2.5 pl-[3px]">
          <span className="font-mono type-caption text-muted-foreground">+{overflow} more</span>
        </li>
      ) : null}
    </ol>
  );
}

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
