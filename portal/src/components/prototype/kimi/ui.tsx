/**
 * Prototype "kimi" — shared presentational primitives.
 *
 * Small, composable pieces used across the prototype surfaces. Status is never
 * communicated by colour alone: every dot ships with an adjacent text label.
 */

import type { ReactNode } from "react";
import { IconMinus, IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

import type { Evidence, SourceId, StateKind } from "./fixtures";
import { SOURCES, STATE_KIND_LABEL, fmtUtc, freshnessOf, timeAgo } from "./fixtures";

// ---------------------------------------------------------------------------
// Status dot (8px) with tone mapping
// ---------------------------------------------------------------------------

export type Tone = "success" | "warning" | "critical" | "info" | "neutral" | "na" | "brand";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-critical",
  info: "bg-info",
  neutral: "bg-muted-foreground",
  na: "bg-transparent shadow-[inset_0_0_0_1.5px_var(--color-border-strong)]",
  brand: "bg-primary",
};

export function StatusDot({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", TONE_CLASS[tone], className)}
    />
  );
}

// ---------------------------------------------------------------------------
// State kind chip (observed / derived / declared / atlas / unknown)
// ---------------------------------------------------------------------------

const KIND_CLASS: Record<StateKind, string> = {
  observed: "border-success/50 text-success-ink",
  derived: "border-info/50 text-info-ink",
  declared: "border-border-strong text-foreground",
  atlas: "border-primary/50 text-brand-ink",
  unknown: "border-dashed border-border-strong text-muted-foreground",
};

export function KindChip({ kind, className }: { kind: StateKind; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[2px] border px-1.5 py-px text-[10px] font-semibold tracking-[0.04em] uppercase",
        KIND_CLASS[kind],
        className,
      )}
    >
      {STATE_KIND_LABEL[kind]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Source chip (neutral vendor label)
// ---------------------------------------------------------------------------

export function SourceChip({ source, className }: { source: SourceId; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[2px] border border-border bg-transparent px-1.5 py-px text-[10px] font-medium tracking-[0.02em] text-muted-foreground",
        className,
      )}
    >
      {SOURCES[source].label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Freshness marker: retrieval time + fresh/stale label
// ---------------------------------------------------------------------------

export function Freshness({ retrievedAt, className }: { retrievedAt: string; className?: string }) {
  const freshness = freshnessOf(retrievedAt);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] tabular-nums",
        freshness === "stale" ? "text-warning-ink" : "text-muted-foreground",
        className,
      )}
    >
      <StatusDot tone={freshness === "stale" ? "warning" : "neutral"} className="size-1.5" />
      {freshness === "stale"
        ? `stale, ${timeAgo(retrievedAt)} old`
        : `fresh, ${timeAgo(retrievedAt)} ago`}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Mono inline tag (identifiers only, never table columns)
// ---------------------------------------------------------------------------

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        "rounded-[2px] bg-muted px-1 py-px font-mono text-[11px] font-semibold tracking-[0.03em] text-foreground",
        className,
      )}
    >
      {children}
    </code>
  );
}

// ---------------------------------------------------------------------------
// Evidence row: label, external id, source, retrieval, freshness
// ---------------------------------------------------------------------------

export function EvidenceRow({ evidence }: { evidence: Evidence }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 first:pt-0 last:pb-0">
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-foreground">
        {evidence.label}
        {evidence.note ? (
          <span className="block text-xs leading-snug text-muted-foreground">{evidence.note}</span>
        ) : null}
      </span>
      {evidence.externalId ? <Mono>{evidence.externalId}</Mono> : null}
      <SourceChip source={evidence.source} />
      <Freshness retrievedAt={evidence.retrievedAt} />
    </li>
  );
}

// ---------------------------------------------------------------------------
// Panel and section header
// ---------------------------------------------------------------------------

export function Panel({
  className,
  children,
  ...props
}: React.ComponentProps<"section"> & { children: ReactNode }) {
  return (
    <section className={cn("rounded-md border border-border bg-card", className)} {...props}>
      {children}
    </section>
  );
}

export function SectionHead({
  title,
  hint,
  actions,
  className,
}: {
  title: ReactNode;
  hint?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1", className)}>
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page header with the contour band
// ---------------------------------------------------------------------------

export function PageHead({
  title,
  description,
  meta,
  contour = false,
}: {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  contour?: boolean;
}) {
  return (
    <header
      className={cn("rounded-md border border-border bg-card px-5 py-4", contour && "pv-contour")}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 max-w-[65ch]">
          <h1 className="text-xl font-bold tracking-[-0.02em] text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {meta ? <div className="flex shrink-0 flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border-strong px-5 py-6">
      {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-[52ch] text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confidence chip (diagnosis hypotheses); icon + text, never colour-only
// ---------------------------------------------------------------------------

export function ConfidenceChip({ level }: { level: "high" | "medium" | "ruled-out" }) {
  if (level === "ruled-out") {
    return (
      <span className="inline-flex items-center gap-1 rounded-[2px] border border-border px-1.5 py-px text-[11px] font-semibold text-muted-foreground">
        <IconMinus size={12} strokeWidth={2} aria-hidden />
        Ruled out
      </span>
    );
  }
  const high = level === "high";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-px text-[11px] font-semibold",
        high ? "border-success/50 text-success-ink" : "border-warning/50 text-warning-ink",
      )}
    >
      {high ? (
        <IconTrendingUp size={12} strokeWidth={2} aria-hidden />
      ) : (
        <IconTrendingDown size={12} strokeWidth={2} aria-hidden />
      )}
      {high ? "High confidence" : "Medium confidence"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Key/value row for context strips
// ---------------------------------------------------------------------------

export function KeyVal({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {k}
      </dt>
      <dd className="min-w-0 truncate text-[13px] font-medium text-foreground">{children}</dd>
    </div>
  );
}

export { fmtUtc, timeAgo };
