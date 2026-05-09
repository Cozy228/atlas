import { Link } from "@tanstack/react-router";
import { IconArrowUpRight } from "@tabler/icons-react";

import type {
  AvailabilityRecord,
  Location,
  LocationStatus,
} from "@/api/server/availability";
import { StatusChip, statusLabel } from "@/components/explore/status-chip";
import { cn } from "@/lib/utils";

type AvailabilityStripProps = {
  service: AvailabilityRecord | null;
  locations: ReadonlyArray<Location>;
};

export function AvailabilityStrip({
  service,
  locations,
}: AvailabilityStripProps) {
  if (!service) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-4 text-[13px] text-muted-foreground">
        No availability projection registered for this capability.{" "}
        <Link
          to="/explore"
          className="text-primary underline-offset-2 hover:underline"
        >
          Browse availability map
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <ul
        className="grid divide-x divide-border"
        style={{
          gridTemplateColumns: `repeat(${locations.length}, minmax(0, 1fr))`,
        }}
      >
        {locations.map((location) => {
          const cell = service.availability[location.id];
          const status: LocationStatus = cell?.status ?? "not-planned";
          const sub =
            status === "planned" && cell?.note
              ? `ETA: ${cell.note}`
              : location.sub;
          return (
            <li key={location.id} className="flex flex-col gap-1.5 px-3 py-2.5">
              <span className="text-[12px] font-bold tracking-[-0.01em] text-foreground">
                {location.label}
              </span>
              <span className="text-[10px] text-muted-foreground">{sub}</span>
              <StatusChip status={status} text={statusLabel(status)} />
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-end border-t border-border bg-background px-3 py-2">
        <Link
          to="/explore"
          className={cn(
            "inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-primary",
            "underline-offset-2 hover:underline",
          )}
        >
          Open in availability map <IconArrowUpRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}
