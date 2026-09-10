/**
 * Prototype `atlas` — shared UI primitives
 * ========================================
 * Blueprint-calibrated building blocks (DESIGN.md): hairline panels on the
 * coordinate-grid canvas, status dots, square chips, mono eyebrows. Tokens come
 * from the shipped portal's globals.css — this prototype adds no colours.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { IconArrowLeft, IconArrowNarrowRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { FaceDef } from "./faces";

/* ------------------------------------------------------------------ */
/* Type                                                                */
/* ------------------------------------------------------------------ */

/** 11px mono uppercase section kicker. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Inline system identifier: mono, 12px, weight 600 (DESIGN.md §3). */
export function Id({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-[12px] font-semibold tracking-[0.01em]", className)}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Status                                                              */
/* ------------------------------------------------------------------ */

export type DotState = "healthy" | "degraded" | "critical" | "unknown";

const DOT_CLASS: Record<DotState, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  critical: "bg-critical",
  unknown: "border-[1.5px] border-current text-transparent",
};

/**
 * 8px status dot — the primary health signal. `unknown` draws as a hollow
 * ring: no data is a state, not an error (DESIGN.md §4).
 */
export function StatusDot({ state, className }: { state: DotState; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", DOT_CLASS[state], className)}
    />
  );
}

export type ChipTone = "neutral" | "success" | "warning" | "critical" | "info" | "brand";

const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  neutral: "border-border-strong text-muted-foreground",
  success: "border-success/40 text-success-ink",
  warning: "border-warning/50 text-warning-ink",
  critical: "border-critical/40 text-critical-ink",
  info: "border-info/40 text-info-ink",
  brand: "border-brand/40 text-brand-ink",
};

/** Square chip: 2px radius, hairline border, transparent fill (DESIGN.md §4). */
export function Chip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-px text-[11px] font-semibold leading-[1.5]",
        CHIP_TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Panels                                                              */
/* ------------------------------------------------------------------ */

/**
 * Solid surface panel laid over the grid canvas. Hairline border, no shadow
 * at rest (DESIGN.md §6). Brand corner ticks mark key panels.
 */
export function Panel({
  title,
  note,
  actions,
  ticks = false,
  children,
  className,
}: {
  title?: string;
  note?: string;
  actions?: ReactNode;
  ticks?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative rounded-[4px] border border-border bg-card",
        ticks &&
          "corner-ticks before:pointer-events-none before:absolute before:-top-px before:-left-px before:size-[7px] before:border-t-[1.5px] before:border-l-[1.5px] before:border-brand before:opacity-50 after:pointer-events-none after:absolute after:-right-px after:-bottom-px after:size-[7px] after:border-r-[1.5px] after:border-b-[1.5px] after:border-brand after:opacity-50",
        className,
      )}
    >
      {(title !== undefined || actions !== undefined) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-3.5">
          <div className="min-w-0">
            {title !== undefined && (
              <h2 className="text-[15px] font-bold tracking-[-0.01em] text-foreground">{title}</h2>
            )}
            {note !== undefined && (
              <p className="mt-0.5 text-[12px] leading-[1.45] text-muted-foreground">{note}</p>
            )}
          </div>
          {actions !== undefined && (
            <div className="flex shrink-0 items-center gap-1">{actions}</div>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

/** Page header for workbench faces: face name + one-line purpose + aside. */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 bg-background pr-1">
      <div className="min-w-0">
        {eyebrow !== undefined && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {lead !== undefined && (
          <p className="mt-1 max-w-[65ch] text-[13px] leading-[1.55] text-muted-foreground">
            {lead}
          </p>
        )}
      </div>
      {actions !== undefined && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

/**
 * Micro SVG sparkline for 7d metric trends (error rate, p95 latency, uptime).
 * Tabular, calm, with gradient fill and crisp hairline stroke.
 */
export function Sparkline({
  data,
  tone = "neutral",
  className,
}: {
  data: ReadonlyArray<number>;
  tone?: "neutral" | "success" | "critical" | "warning";
  className?: string;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 64;
  const height = 20;
  const padding = 2;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * (width - padding * 2) + padding;
      const y = height - ((val - min) / range) * (height - padding * 2) - padding;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const colorMap = {
    neutral: "var(--brand, oklch(46.28% 0.3059 264.18))",
    success: "oklch(56% 0.13 152)",
    critical: "oklch(55% 0.2 25)",
    warning: "oklch(70% 0.15 75)",
  };

  const strokeColor = colorMap[tone];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity={0.85}
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Provenance & Evidence                                               */
/* ------------------------------------------------------------------ */

/**
 * Provenance tag: [O] Observed, [D] Derived, [DEC] Declared, [ATL] Atlas, [?] Unknown.
 */
export function ProvenanceTag({
  provenance,
  className,
}: {
  provenance: "observed" | "derived" | "declared" | "atlas" | "unknown";
  className?: string;
}) {
  const labels: Record<string, { mark: string; title: string }> = {
    observed: { mark: "OBS", title: "Observed: Read directly from authoritative source system" },
    derived: { mark: "DER", title: "Derived: Computed by Atlas from observed facts" },
    declared: { mark: "DEC", title: "Declared: Asserted by a human team/lead" },
    atlas: { mark: "ATL", title: "Atlas: Native platform state & governance" },
    unknown: { mark: "UNK", title: "Unknown: Unmapped or unreachable source" },
  };
  const item = labels[provenance] ?? { mark: "SYS", title: provenance };

  return (
    <span
      title={item.title}
      className={cn(
        "inline-flex items-center rounded-[2px] bg-secondary px-1 py-0.5 font-mono text-[9px] font-bold tracking-[0.05em] text-muted-foreground",
        className,
      )}
    >
      {item.mark}
    </span>
  );
}

/** Structured evidence callout [n] with source lineage */
export function EvidenceRow({
  label,
  value,
  provenance = "observed",
  systemMark,
  recordedAt,
}: {
  label: string;
  value: string;
  provenance?: "observed" | "derived" | "declared" | "atlas" | "unknown";
  systemMark?: string;
  recordedAt?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5 text-[12px] border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <ProvenanceTag provenance={provenance} />
        <span className="text-muted-foreground truncate">{label}:</span>
        <span className="font-mono font-semibold text-foreground truncate">{value}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground">
        {systemMark && <span className="font-mono">{systemMark}</span>}
        {recordedAt && <span>{recordedAt}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Placeholder                                                         */
/* ------------------------------------------------------------------ */

/**
 * Structured placeholder for a face that arrives in a later batch. States what
 * the face will answer and what it will contain — never a bare "empty" page.
 */
export function FacePlaceholder({ face, appId }: { face: FaceDef; appId: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5 bg-background">
      <PageHeader
        eyebrow="Workbench"
        title={face.label}
        lead={`${face.purpose} This surface arrives in a later batch of the prototype.`}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link to="/prototype/$appId/overview" params={{ appId }} />}
          >
            <IconArrowLeft size={14} aria-hidden />
            Overview
          </Button>
        }
      />
      <Panel title="Planned content" note="From the app-centric experience architecture, §6d.">
        <ul className="flex flex-col gap-2 px-4 py-3.5">
          {(face.planned ?? [face.purpose]).map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-[13px] leading-[1.55] text-foreground"
            >
              <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-brand" />
              {item}
            </li>
          ))}
        </ul>
        <footer className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5">
          <p className="text-[12px] text-muted-foreground">
            Batch order: Onboard → Scaffold → remaining faces → Diagnose.
          </p>
          <Link
            to="/prototype"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to Home
            <IconArrowNarrowRight size={13} aria-hidden />
          </Link>
        </footer>
      </Panel>
    </div>
  );
}
