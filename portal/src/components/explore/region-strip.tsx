import type { AvailabilityRecord, Location, LocationStatus } from "@/api/server/availability";
import { cn } from "@/lib/utils";

type RegionStripProps = {
  locations: ReadonlyArray<Location>;
  services: ReadonlyArray<AvailabilityRecord>;
  active: string | null;
  onSelect: (locationId: string | null) => void;
};

export function RegionStrip({ locations, services, active, onSelect }: RegionStripProps) {
  return (
    <div role="radiogroup" aria-label="Filter by location" className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-muted-foreground">Region</span>
      {locations.map((location) => {
        const counts = countByStatus(services, location.id);
        const isActive = active === location.id;
        const total = counts.available + counts.planned;
        return (
          <button
            key={location.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(isActive ? null : location.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 transition-[border-color,background-color]",
              "hover:border-border-strong hover:bg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive && "border-primary bg-brand-tint",
            )}
          >
            <span className="text-xs font-semibold text-foreground">{location.label}</span>
            {total > 0 ? (
              <span className="font-mono type-caption font-semibold text-muted-foreground">
                {counts.available > 0 ? (
                  <span className="text-success">{counts.available}</span>
                ) : null}
                {counts.available > 0 && counts.planned > 0 ? "/" : null}
                {counts.planned > 0 ? (
                  <span className="text-info">{counts.planned}</span>
                ) : null}
              </span>
            ) : null}
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
