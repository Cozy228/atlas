import { ServiceIcon } from "@/components/explore/service-icon";
import type { ServiceIconProvider } from "@/components/explore/service-icon";
import { StatusChip } from "@/components/explore/status-chip";
import type { AvailabilityRow } from "@/lib/availability-row-model";
import { cn } from "@/lib/utils";

type ServiceCardProps = {
  provider: ServiceIconProvider;
  row: AvailabilityRow;
  selected: boolean;
  onSelect: () => void;
};

const VISIBLE_CHIPS = 3;

export function ServiceCard({ provider, row, selected, onSelect }: ServiceCardProps) {
  const { service } = row;
  const visible = row.activeLocations.slice(0, VISIBLE_CHIPS);
  const overflow = row.activeLocations.length - visible.length;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "group relative flex w-full flex-col gap-2.5 rounded-lg border border-border bg-card p-4 text-left transition-[border-color,box-shadow]",
        "hover:border-border-strong hover:shadow-sm",
        // Skip paint of off-screen cards so only the visible grid paints on first open.
        "[content-visibility:auto] [contain-intrinsic-size:auto_112px]",
        // Brand corner ticks (DESIGN.md §06 capability card): 7px L-brackets, opacity .5.
        "before:pointer-events-none before:absolute before:-top-px before:-left-px before:size-[7px] before:border-t before:border-l before:border-brand before:opacity-50 before:content-['']",
        "after:pointer-events-none after:absolute after:-right-px after:-bottom-px after:size-[7px] after:border-r after:border-b after:border-brand after:opacity-50 after:content-['']",
        "data-[selected=true]:border-primary data-[selected=true]:shadow-[0_0_0_2px_color-mix(in_srgb,var(--primary)_8%,transparent)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="flex items-center gap-2.5">
        <ServiceIcon serviceId={service.id} provider={provider} size="md" />
        <span className="type-body font-semibold leading-tight text-foreground">
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
              "inline-flex items-center rounded border border-border bg-background px-1.5 py-px",
              "font-mono type-chip font-medium text-muted-foreground",
            )}
          >
            +{overflow}
          </span>
        ) : null}
      </div>
    </button>
  );
}
