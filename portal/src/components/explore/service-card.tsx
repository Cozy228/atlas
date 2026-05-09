import type { AvailabilityRecord, Location } from "@/api/server/availability";
import { StatusChip } from "@/components/explore/status-chip";
import { cn } from "@/lib/utils";

type ServiceCardProps = {
  service: AvailabilityRecord;
  locations: ReadonlyArray<Location>;
  selected: boolean;
  onSelect: () => void;
};

const VISIBLE_CHIPS = 3;

export function ServiceCard({ service, locations, selected, onSelect }: ServiceCardProps) {
  const active = locations.filter(
    (location) =>
      service.availability[location.id] &&
      service.availability[location.id]?.status !== "not-planned",
  );
  const visible = active.slice(0, VISIBLE_CHIPS);
  const overflow = active.length - visible.length;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "group flex w-full flex-col gap-2 rounded-lg border border-border bg-card px-3.5 py-3 text-left transition-[border-color,box-shadow]",
        "hover:border-border-strong hover:shadow-sm",
        "data-[selected=true]:border-primary data-[selected=true]:shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_8%,transparent)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "flex size-[30px] shrink-0 items-center justify-center rounded-md border border-border bg-background",
            "font-mono text-[9px] font-bold uppercase tracking-tight text-primary",
          )}
        >
          {service.iconKey}
        </span>
        <span className="text-[13px] font-semibold leading-tight text-foreground">
          {service.name}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {visible.length === 0 ? (
          <StatusChip status="not-planned" text="No availability" />
        ) : (
          visible.map((location) => {
            const cell = service.availability[location.id];
            if (!cell) return null;
            const text =
              cell.status === "planned" && cell.note
                ? `${location.label} ${cell.note}`
                : location.label;
            return <StatusChip key={location.id} status={cell.status} text={text} />;
          })
        )}
        {overflow > 0 ? (
          <span
            className={cn(
              "inline-flex items-center rounded border border-border bg-background px-1.5 py-0.5",
              "font-mono text-[10px] font-semibold text-muted-foreground",
            )}
          >
            +{overflow}
          </span>
        ) : null}
      </div>
    </button>
  );
}
