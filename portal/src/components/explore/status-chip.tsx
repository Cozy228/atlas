import type { LocationStatus } from "@/api/server/availability";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<LocationStatus, string> = {
  available: "bg-success/10 text-success",
  planned: "bg-info/10 text-info",
  interim: "bg-warning/15 text-warning-foreground",
  "not-planned": "border border-border bg-card text-muted-foreground",
};

const STATUS_LABELS: Record<LocationStatus, string> = {
  available: "Available",
  planned: "Planned",
  interim: "Interim",
  "not-planned": "Not planned",
};

export function StatusChip({
  status,
  text,
  size = "sm",
}: {
  status: LocationStatus;
  text?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded font-mono font-semibold",
        size === "sm" ? "px-1.5 py-0.5 type-status-chip" : "px-2 py-0.5 type-caption",
        STATUS_STYLES[status],
      )}
    >
      <span aria-hidden className="size-[5px] rounded-full bg-current" />
      {text ?? STATUS_LABELS[status]}
    </span>
  );
}

export function statusLabel(status: LocationStatus): string {
  return STATUS_LABELS[status];
}
