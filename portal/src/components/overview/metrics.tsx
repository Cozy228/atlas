/**
 * dashboard primitives shared by the
 * `/overview` directions: deterministic sparklines (stable across SSR),
 * KPI stat cards, a condition gauge, and the page header with the demo-snapshot
 * line. Kept presentational; data comes from `lib/ops.ts`.
 */
import { SnapshotLine } from "./shared";
import { cn } from "@/lib/utils";

/* -- deterministic mini-series (no Math.random: must match on server + client) -- */

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A stable wandering 0..1 series seeded by a string (e.g. a service id). */
export function sparkSeries(seed: string, points = 12): number[] {
  let s = hash(seed) || 1;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  let cur = 0.45 + next() * 0.2;
  const out: number[] = [];
  for (let i = 0; i < points; i += 1) {
    cur = Math.min(0.95, Math.max(0.08, cur + (next() - 0.45) * 0.28));
    out.push(cur);
  }
  return out;
}

/* -- sparkline ----------------------------------------------------------------- */

export function Sparkline({
  values,
  width = 96,
  height = 28,
  className,
  area = false,
}: {
  values: ReadonlyArray<number>;
  width?: number;
  height?: number;
  className?: string;
  area?: boolean;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const stepX = (width - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fill = `${pad},${height - pad} ${line} ${width - pad},${height - pad}`;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("overflow-visible", className)}
      aria-hidden
      preserveAspectRatio="none"
    >
      {area ? <polygon points={fill} className="fill-current opacity-[0.08]" /> : null}
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* -- KPI stat card ------------------------------------------------------------- */

export type KpiTone = "neutral" | "success" | "warning" | "critical" | "info";

const KPI_TONE_TEXT: Record<KpiTone, string> = {
  neutral: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  critical: "text-critical",
  info: "text-info",
};

export function KpiCard({
  label,
  value,
  unit,
  note,
  spark,
  sparkTone = "neutral",
  area = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  note?: string;
  spark?: ReadonlyArray<number>;
  sparkTone?: KpiTone;
  area?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[4px] border border-border bg-card px-3.5 py-2.5">
      <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <div className="flex items-end justify-between gap-3">
        <span className="flex items-baseline gap-1">
          <span className="text-[1.5rem] font-bold leading-none tabular-nums tracking-[-0.02em] text-foreground">
            {value}
          </span>
          {unit ? <span className="text-[12px] text-muted-foreground">{unit}</span> : null}
        </span>
        {spark ? (
          <Sparkline
            values={spark}
            area={area}
            className={cn("shrink-0", KPI_TONE_TEXT[sparkTone])}
          />
        ) : null}
      </div>
      {note ? (
        <span className="text-[11px] leading-[1.35] text-muted-foreground">{note}</span>
      ) : null}
    </div>
  );
}

/* -- condition gauge (a single dominant readout for the "pulse" dashboard) ----- */

export function ConditionGauge({ pct, label }: { pct: number; label: string }) {
  const size = 108;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const tone = pct >= 95 ? "text-success" : pct >= 80 ? "text-warning" : "text-critical";
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className={cn(
            "transition-[stroke-dasharray] duration-500 motion-reduce:transition-none",
            tone,
          )}
          stroke="currentColor"
        />
      </svg>
      <span className="absolute flex flex-col items-center">
        <span className="text-[1.75rem] font-bold tabular-nums tracking-[-0.02em] text-foreground">
          {pct}%
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {label}
        </span>
      </span>
    </div>
  );
}

/* -- page header --------------------------------------------------------------- */

export function DashHeader({ lede }: { lede: string }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="flex flex-col gap-1.5">
        <h1 className="w-fit bg-background text-2xl font-bold tracking-[-0.02em] text-foreground">
          Operations
        </h1>
        <p className="w-fit max-w-[60ch] bg-background text-[13.5px] leading-[1.55] text-muted-foreground">
          {lede}
        </p>
      </div>
      <SnapshotLine />
    </header>
  );
}
