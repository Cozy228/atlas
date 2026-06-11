/**
 * PROTOTYPE (production candidate) — shared pieces for the `/proto/overview`
 * directions: status vocabulary (dots, env tags, deploy glyphs) and the
 * demo-snapshot self-description every variant must carry.
 */
import { IconCheck, IconMinus, IconPlayerPlay, IconX } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import {
  ENV_LABEL,
  SNAPSHOT_AT,
  type AttentionItem,
  type DeployStatus,
  type Env,
  type ServiceHealth,
} from "@/lib/ops";
import { cn } from "@/lib/utils";

export const HEALTH_DOT: Record<ServiceHealth, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  down: "bg-critical",
};

export const HEALTH_LABEL: Record<ServiceHealth, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
};

export function HealthDot({ health, className }: { health: ServiceHealth; className?: string }) {
  return (
    <span aria-hidden className={cn("size-2 shrink-0 rounded-full", HEALTH_DOT[health], className)} />
  );
}

export function HealthLabel({ health }: { health: ServiceHealth }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
      <HealthDot health={health} />
      {HEALTH_LABEL[health]}
    </span>
  );
}

/** Environment tag; prod carries the weight, lower envs stay quiet. */
export function EnvTag({ env }: { env: Env }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[2px] border px-1.5 py-px text-[10.5px] font-semibold uppercase tracking-[0.04em]",
        env === "prod"
          ? "border-border-strong text-foreground"
          : "border-border text-muted-foreground",
      )}
    >
      {ENV_LABEL[env]}
    </span>
  );
}

const DEPLOY_META: Record<
  DeployStatus,
  { icon: typeof IconCheck; className: string; label: string }
> = {
  success: { icon: IconCheck, className: "text-success", label: "Succeeded" },
  failed: { icon: IconX, className: "text-critical", label: "Failed" },
  running: { icon: IconPlayerPlay, className: "text-info", label: "Running" },
  cancelled: { icon: IconMinus, className: "text-muted-foreground", label: "Cancelled" },
};

export function DeployStatusGlyph({ status }: { status: DeployStatus }) {
  const meta = DEPLOY_META[status];
  const Glyph = meta.icon;
  return (
    <span title={meta.label} className={cn("inline-flex", meta.className)}>
      <Glyph aria-hidden className="size-3.5" strokeWidth={2.5} />
      <span className="sr-only">{meta.label}</span>
    </span>
  );
}

export function DeployStatusLabel({ status }: { status: DeployStatus }) {
  const meta = DEPLOY_META[status];
  return (
    <span className={cn("inline-flex items-center gap-1 text-[12px] font-semibold", meta.className)}>
      <DeployStatusGlyph status={status} />
      {meta.label}
    </span>
  );
}

const ATTENTION_DOT: Record<AttentionItem["tone"], string> = {
  critical: "bg-critical",
  warning: "bg-warning",
  info: "bg-info",
};

/** Priority-sorted "needs attention" feed (incidents · failed · degraded · in-flight). */
export function AttentionFeed({
  items,
  limit,
}: {
  items: ReadonlyArray<AttentionItem>;
  limit?: number;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  if (shown.length === 0) {
    return (
      <p className="rounded-[4px] border border-border bg-card px-3.5 py-5 text-[13px] text-muted-foreground">
        Nothing needs attention. Every service is healthy and no deploy is failing.
      </p>
    );
  }
  return (
    <ul className="flex flex-col overflow-hidden rounded-[4px] border border-border bg-card">
      {shown.map((item, i) => (
        <li key={item.id} className={cn("flex gap-3 px-3.5 py-3", i > 0 && "border-t border-border")}>
          <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", ATTENTION_DOT[item.tone])} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-[13.5px] font-bold tracking-[-0.01em] text-foreground">
                {item.title}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
                {item.kind}
              </span>
            </div>
            <p className="text-[12px] leading-[1.5] text-muted-foreground">{item.note}</p>
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{item.at}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Ship-state honesty: this surface renders frozen fixtures, and says so. */
export function SnapshotLine() {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant="brand" className="font-mono type-caption">
        demo snapshot
      </Badge>
      <span className="bg-background font-mono text-[11px] tabular-nums text-muted-foreground">
        {SNAPSHOT_AT}
      </span>
    </span>
  );
}
