import type { LocationStatus } from "@/api/server/availability";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const DOT_STYLES: Record<LocationStatus, string> = {
  available: "bg-success shadow-[0_0_0_2px_oklch(from_var(--success)_l_c_h/0.15)]",
  planned: "bg-info shadow-[0_0_0_2px_oklch(from_var(--info)_l_c_h/0.15)]",
  interim: "bg-warning shadow-[0_0_0_2px_oklch(from_var(--warning)_l_c_h/0.15)]",
  "not-planned": "bg-muted-foreground/25",
};

const STATUS_LABELS: Record<LocationStatus, string> = {
  available: "Available",
  planned: "Planned",
  interim: "Interim",
  "not-planned": "Not planned",
};

type StatusDotProps = {
  status: LocationStatus;
  /** Extra tooltip text (e.g. ETA, region name). */
  note?: string;
  /** Dot diameter variant. */
  size?: "sm" | "md";
  /** Use only for low-density surfaces; dense matrices should stay static. */
  tooltip?: boolean;
};

export function StatusDot({ status, note, size = "md", tooltip = false }: StatusDotProps) {
  const label = STATUS_LABELS[status];
  const tip = note ? `${label} · ${note}` : label;
  const dot = (
    <span
      aria-label={tip}
      title={tip}
      className={cn(
        "inline-block shrink-0 rounded-full transition-transform hover:scale-125",
        size === "sm" ? "size-2" : "size-2.5",
        DOT_STYLES[status],
      )}
    />
  );

  if (!tooltip) return dot;

  return (
    <Tooltip>
      <TooltipTrigger>{dot}</TooltipTrigger>
      <TooltipContent side="top" className="font-mono text-xs">
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
