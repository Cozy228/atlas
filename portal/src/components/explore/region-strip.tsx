import type {
  AvailabilityRecord,
  Location,
  LocationStatus,
} from "@/api/server/availability";
import { cn } from "@/lib/utils";

type RegionStripProps = {
  locations: ReadonlyArray<Location>;
  services: ReadonlyArray<AvailabilityRecord>;
  active: string | null;
  onSelect: (locationId: string | null) => void;
};

export function RegionStrip({
  locations,
  services,
  active,
  onSelect,
}: RegionStripProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Filter by location"
      className="grid gap-2"
      style={{
        gridTemplateColumns: `repeat(${Math.min(locations.length, 5)}, minmax(0, 1fr))`,
      }}
    >
      {locations.map((location) => {
        const counts = countByStatus(services, location.id);
        const isActive = active === location.id;
        return (
          <button
            key={location.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(isActive ? null : location.id)}
            className={cn(
              "rounded-lg border border-border bg-card p-3 text-left transition-[border-color,background-color]",
              "hover:border-border-strong",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive && "border-primary bg-brand-tint",
            )}
          >
            <p className="text-[12px] font-bold tracking-[-0.01em] text-foreground">
              {location.label}
            </p>
            <p className="mb-1.5 text-[10px] text-muted-foreground">
              {location.sub}
            </p>
            <p className="flex flex-wrap gap-2 font-mono text-[10px] font-semibold">
              {counts.available > 0 ? (
                <span className="text-success">{counts.available} avail</span>
              ) : null}
              {counts.planned > 0 ? (
                <span className="text-info">{counts.planned} planned</span>
              ) : null}
              {counts.available === 0 && counts.planned === 0 ? (
                <span className="text-muted-foreground">none yet</span>
              ) : null}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function countByStatus(
  services: ReadonlyArray<AvailabilityRecord>,
  locationId: string,
): Record<LocationStatus, number> {
  const result: Record<LocationStatus, number> = {
    available: 0,
    planned: 0,
    interim: 0,
    "not-planned": 0,
  };
  for (const service of services) {
    const cell = service.availability[locationId];
    const status = cell?.status ?? "not-planned";
    result[status] += 1;
  }
  return result;
}
