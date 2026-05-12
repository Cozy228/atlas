import { IconArrowUpRight, IconX } from "@tabler/icons-react";

import type { AvailabilityRecord, Location } from "@/api/server/availability";
import { ServiceIcon } from "@/components/explore/service-icon";
import { StatusChip, statusLabel } from "@/components/explore/status-chip";
import { cn } from "@/lib/utils";

type ExpandPanelProps = {
  service: AvailabilityRecord;
  locations: ReadonlyArray<Location>;
  onClose: () => void;
};

export function ExpandPanel({ service, locations, onClose }: ExpandPanelProps) {
  const planned = locations.reduce<string[]>((acc, location) => {
    const cell = service.availability[location.id];
    if (cell?.status === "planned" && cell.note && cell.note !== "TBD") acc.push(cell.note);
    return acc;
  }, []).sort();
  const everyAvailable =
    locations.filter((l) => service.availability[l.id]?.status === "available").length > 0 &&
    locations
      .filter((l) => service.availability[l.id])
      .every((l) => service.availability[l.id]?.status === "available");

  return (
    <article
      role="region"
      aria-label={`${service.name} availability detail`}
      className={cn(
        "col-span-full overflow-hidden rounded-xl border-[1.5px] border-primary bg-card",
        "shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_5%,transparent),0_8px_24px_color-mix(in_srgb,var(--primary)_8%,transparent)]",
        "[animation:expandIn_220ms_cubic-bezier(0.22,1,0.36,1)]",
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <ServiceIcon serviceId={service.id} size="lg" />
          <div>
            <p className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
              {service.name}
            </p>
            <p className="text-[11px] text-muted-foreground">{service.domain}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail"
          className={cn(
            "flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground",
            "transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <IconX className="size-3.5" />
        </button>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2">
        <section className="border-b border-border p-5 lg:border-b-0 lg:border-r">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            Availability by location
          </p>
          <ul className="flex flex-col gap-1">
            {locations.map((location) => {
              const cell = service.availability[location.id];
              const status = cell?.status ?? "not-planned";
              const sub = status === "planned" && cell?.note ? `ETA: ${cell.note}` : location.sub;
              return (
                <li
                  key={location.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
                >
                  <span className="flex flex-col">
                    <span className="text-[13px] font-semibold text-foreground">
                      {location.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{sub}</span>
                  </span>
                  <StatusChip status={status} text={statusLabel(status)} />
                </li>
              );
            })}
          </ul>
          <Guidance
            everyAvailable={everyAvailable}
            nextEta={planned[0]}
            hasPlanned={
              planned.length > 0 ||
              locations.some((l) => service.availability[l.id]?.status === "planned")
            }
          />
        </section>
        <section className="p-5">
          <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
            Next steps
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <ActionButton primary>Open catalog</ActionButton>
            <ActionButton>User guide</ActionButton>
            <ActionButton>Onboarding</ActionButton>
            <ActionButton>Support</ActionButton>
          </div>
          <p className="mt-3 border-t border-border pt-2 font-mono text-[10px] text-muted-foreground">
            Source projection: catalog.md. Production surfaces show anchors, freshness, and warnings
            per cell.
          </p>
        </section>
      </div>
      <style>{`@keyframes expandIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </article>
  );
}

function Guidance({
  everyAvailable,
  nextEta,
  hasPlanned,
}: {
  everyAvailable: boolean;
  nextEta?: string;
  hasPlanned: boolean;
}) {
  if (hasPlanned) {
    return (
      <div className="mt-3 rounded-md border border-info/20 bg-info/5 p-3">
        <p className="text-[11px] font-bold text-foreground">Rollout in progress</p>
        <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
          {nextEta ? `Next expected: ${nextEta}.` : "Timeline TBD."} Contact the platform team for
          interim access.
        </p>
      </div>
    );
  }
  if (everyAvailable) {
    return (
      <div className="mt-3 rounded-md border border-success/20 bg-success/5 p-3">
        <p className="text-[11px] font-bold text-foreground">Ready to use</p>
        <p className="mt-0.5 text-[12px] leading-5 text-muted-foreground">
          Proceed to service catalog or user guide to begin onboarding.
        </p>
      </div>
    );
  }
  return null;
}

function ActionButton({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-[13px] font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
      {primary ? <IconArrowUpRight aria-hidden className="size-3.5" /> : null}
    </button>
  );
}
