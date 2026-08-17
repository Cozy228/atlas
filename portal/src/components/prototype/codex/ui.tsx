import type { ReactNode } from "react";
import {
  IconAlertCircleFilled,
  IconBulb,
  IconChevronRight,
  IconCircle,
  IconCircleCheck,
  IconClock,
  IconEye,
  IconExternalLink,
  IconFileCode,
  IconFileDescription,
  IconFileText,
  IconHelpCircle,
  IconPencil,
  IconShieldCheck,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { EvidenceItem, EvidenceState, JourneyPhase, JourneyStepStatus } from "./fixtures";

const STATE_META: Record<
  EvidenceState,
  { icon: typeof IconEye; className: string; badge: "brand" | "info" | "neutral" | "warning" }
> = {
  Observed: { icon: IconEye, className: "text-primary", badge: "brand" },
  Derived: { icon: IconBulb, className: "text-info-ink", badge: "info" },
  Declared: { icon: IconPencil, className: "text-foreground", badge: "neutral" },
  "Atlas-owned": { icon: IconShieldCheck, className: "text-primary", badge: "brand" },
  Unknown: { icon: IconHelpCircle, className: "text-warning-ink", badge: "warning" },
};

const JOURNEY_META: Record<
  JourneyStepStatus,
  { icon: typeof IconCircleCheck; className: string; label: string }
> = {
  complete: { icon: IconCircleCheck, className: "text-success-ink", label: "Complete" },
  blocked: { icon: IconAlertCircleFilled, className: "text-critical", label: "Blocked" },
  waiting: { icon: IconClock, className: "text-warning-ink", label: "Waiting" },
  upcoming: { icon: IconCircle, className: "text-muted-foreground", label: "Upcoming" },
};

export function StateLabel({
  state,
  compact = false,
}: {
  state: EvidenceState;
  compact?: boolean;
}) {
  const meta = STATE_META[state];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5", compact && "text-xs")}>
      <Icon className={cn("size-4", meta.className)} aria-hidden />
      <span>{state}</span>
    </span>
  );
}

export function StateBadge({ state }: { state: EvidenceState }) {
  const meta = STATE_META[state];
  const Icon = meta.icon;
  return (
    <Badge variant={meta.badge}>
      <Icon className="size-3" aria-hidden />
      {state}
    </Badge>
  );
}

export function PrototypePanel({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "aside" | "div";
}) {
  return <Tag className={cn("rounded-md border border-border bg-card", className)}>{children}</Tag>;
}

export function JourneyRail({
  phases,
  selectedStep,
  onSelect,
}: {
  phases: ReadonlyArray<JourneyPhase>;
  selectedStep?: string;
  onSelect?: (stepId: string) => void;
}) {
  return (
    <ol className="flex flex-col gap-10" aria-label="Journey phases">
      {phases.map((phase, phaseIndex) => (
        <li key={phase.id}>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {phaseIndex + 1}. {phase.label}
          </h2>
          <ol className="flex flex-col" aria-label={`${phase.label} steps`}>
            {phase.steps.map((step, stepIndex) => {
              const meta = JOURNEY_META[step.status];
              const Icon = meta.icon;
              const isSelected = selectedStep === step.id;
              const row = (
                <>
                  <span
                    className={cn(
                      "relative z-10 flex size-6 shrink-0 items-center justify-center",
                      isSelected && !onSelect ? "bg-transparent" : "bg-card",
                    )}
                  >
                    <Icon
                      className={cn(
                        step.status === "upcoming" ? "size-5" : "size-[22px]",
                        meta.className,
                      )}
                      aria-hidden
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block text-[13px] font-medium",
                        isSelected ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {step.label}
                    </span>
                    {isSelected && step.evidence && onSelect ? (
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {step.evidence}
                      </span>
                    ) : null}
                  </span>
                  {isSelected && !onSelect ? (
                    <IconChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  ) : null}
                  <span className="sr-only">{meta.label}</span>
                </>
              );

              return (
                <li
                  key={step.id}
                  className={cn(
                    "relative flex min-h-12 items-center gap-4",
                    stepIndex < phase.steps.length - 1 &&
                      "before:absolute before:top-7 before:-bottom-5 before:left-[11px]",
                    stepIndex < phase.steps.length - 1 &&
                      step.status === "complete" &&
                      "before:w-px before:bg-success/35",
                    stepIndex < phase.steps.length - 1 &&
                      step.status !== "complete" &&
                      "before:w-0 before:border-l before:border-dashed before:border-border",
                    isSelected &&
                      !onSelect &&
                      "-mx-1 min-h-[58px] rounded-md border border-critical/30 bg-critical/[0.035] px-2",
                  )}
                >
                  {onSelect ? (
                    <button
                      type="button"
                      onClick={() => onSelect(step.id)}
                      aria-current={isSelected ? "step" : undefined}
                      className={cn(
                        "flex min-h-12 w-full items-center gap-4 rounded-md px-1 text-left transition-colors hover:bg-muted",
                        isSelected && "bg-muted ring-1 ring-border-strong",
                        step.status === "blocked" &&
                          isSelected &&
                          "bg-critical/[0.045] ring-critical/35",
                      )}
                    >
                      {row}
                    </button>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}

export function EvidenceList({
  items,
  selectedId,
  onSelect,
}: {
  items: ReadonlyArray<EvidenceItem>;
  selectedId?: string;
  onSelect?: (itemId: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      {items.map((item, index) => {
        const selected = selectedId === item.id;
        const FileIcon = evidenceIcon(item.id);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item.id)}
            aria-expanded={onSelect ? selected : undefined}
            className={cn(
              "codex-evidence-row grid min-h-[75.667px] w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:relative",
              "sm:grid-cols-2 sm:items-center",
              index > 0 && "border-t border-border",
              selected && "bg-muted/70",
            )}
          >
            <span className="flex min-w-0 items-start gap-3">
              <FileIcon className="mt-0.5 size-7 shrink-0 text-foreground" aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold text-foreground">
                  {item.title}
                </span>
                <span className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="size-2 rounded-full bg-primary" aria-hidden />
                  {item.state}
                </span>
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] text-muted-foreground">
                {item.identifierLabel}
              </span>
              <span className="mt-1 flex items-center gap-1.5 truncate text-[12px] font-medium text-brand-ink">
                <span className="truncate">{item.identifier}</span>
                <IconExternalLink className="size-3.5 shrink-0" aria-hidden />
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] text-muted-foreground">Retrieved</span>
              <span className="mt-1 block text-[12px] text-muted-foreground">
                {item.retrievedAt}
              </span>
            </span>
            <span>
              <span className="block text-[11px] text-muted-foreground">Freshness</span>
              <span className="mt-1 block text-[12px] font-medium text-success-ink">
                {item.freshness}
              </span>
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] text-muted-foreground">Source</span>
              <span className="mt-1 block whitespace-nowrap text-[10px] text-muted-foreground">
                {item.source}
              </span>
            </span>
            <IconChevronRight
              className="codex-evidence-chevron hidden size-4 justify-self-end text-muted-foreground"
              aria-hidden
            />
            {selected ? (
              <span className="codex-evidence-detail mt-1 border-t border-border pt-3 text-sm leading-6 text-muted-foreground sm:col-span-2">
                {item.detail}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function evidenceIcon(itemId: string) {
  if (itemId === "service-manifest") return IconFileCode;
  if (itemId === "deployment-specification") return IconFileDescription;
  return IconFileText;
}
