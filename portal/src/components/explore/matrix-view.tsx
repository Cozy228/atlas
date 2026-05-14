import { Fragment } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { IconArrowUpRight, IconChevronDown } from "@tabler/icons-react";

import type { AvailabilityRecord, Location } from "@/api/server/availability";
import { ServiceIcon } from "@/components/explore/service-icon";
import { StatusDot } from "@/components/explore/status-dot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MatrixViewProps = {
  locations: ReadonlyArray<Location>;
  groups: ReadonlyArray<readonly [string, ReadonlyArray<AvailabilityRecord>]>;
  selectedServiceId: string | null;
  onSelect: (id: string) => void;
  activeLocationId: string | null;
  onLocationSelect: (id: string | null) => void;
};

export function MatrixView({
  locations,
  groups,
  selectedServiceId,
  onSelect,
  activeLocationId,
  onLocationSelect,
}: MatrixViewProps) {
  const totalCols = locations.length + 1;
  const isWide = locations.length > 6;
  const svcColWidth = isWide ? "22%" : "30%";
  const locColWidth = `${(100 - parseFloat(svcColWidth)) / locations.length}%`;
  const hasActiveCol = activeLocationId !== null;
  return (
    <div className="overflow-clip rounded-lg border border-border bg-card">
      <table className="w-full table-fixed border-collapse type-detail">
        <colgroup>
          <col style={{ width: svcColWidth }} />
          {locations.map((location) => (
            <col key={location.id} style={{ width: locColWidth }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              scope="col"
              className={cn(
                "sticky top-14 z-20 border-b border-border bg-background px-3 py-2.5 text-left",
                "font-mono text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground",
              )}
            >
              Service
            </th>
            {locations.map((location) => {
              const isActive = location.id === activeLocationId;
              return (
                <th
                  key={location.id}
                  scope="col"
                  onClick={() => onLocationSelect(isActive ? null : location.id)}
                  className={cn(
                    "sticky top-14 z-20 border-b border-border bg-background cursor-pointer select-none transition-colors",
                    "font-mono text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground",
                    "hover:text-foreground",
                    isWide ? "px-2 py-2 text-center type-caption" : "whitespace-nowrap px-3 py-2.5",
                    isActive && "bg-brand-tint text-primary",
                  )}
                >
                  {location.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {groups.map(([domain, services]) => (
            <DomainRows
              key={domain}
              domain={domain}
              services={services}
              locations={locations}
              selectedServiceId={selectedServiceId}
              onSelect={onSelect}
              totalCols={totalCols}
              isWide={isWide}
              activeLocationId={activeLocationId}
              hasActiveCol={hasActiveCol}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DomainRows({
  domain,
  services,
  locations,
  selectedServiceId,
  onSelect,
  totalCols,
  isWide,
  activeLocationId,
  hasActiveCol,
}: {
  domain: string;
  services: ReadonlyArray<AvailabilityRecord>;
  locations: ReadonlyArray<Location>;
  selectedServiceId: string | null;
  onSelect: (id: string) => void;
  totalCols: number;
  isWide: boolean;
  activeLocationId: string | null;
  hasActiveCol: boolean;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={totalCols}
          className={cn(
            "border-b border-border bg-background px-3 py-2.5",
            "font-mono text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground",
          )}
        >
          {domain}
        </td>
      </tr>
      {services.map((service) => {
        const isSelected = service.id === selectedServiceId;
        return (
          <Fragment key={service.id}>
            <tr
              onClick={() => onSelect(service.id)}
              data-selected={isSelected ? "true" : undefined}
              className={cn(
                "cursor-pointer border-b border-border last:border-b-0 transition-colors",
                "hover:bg-muted/50",
                "data-[selected=true]:bg-brand-tint",
              )}
              aria-expanded={isSelected}
            >
              <td className="px-3 py-2.5 align-middle">
                <span className="flex min-w-0 items-center gap-2">
                  <ServiceIcon serviceId={service.id} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-foreground">
                    {service.name}
                  </span>
                  <IconChevronDown
                    aria-hidden
                    className={cn(
                      "size-3 shrink-0 text-muted-foreground transition-transform",
                      isSelected && "rotate-180 text-primary",
                    )}
                  />
                </span>
              </td>
              {locations.map((location) => {
                const cell = service.availability[location.id];
                const status = cell?.status ?? "not-planned";
                const note =
                  status === "planned" && cell?.note
                    ? `ETA ${cell.note}`
                    : status === "interim" && cell?.note
                      ? cell.note
                      : location.label;
                const isActiveCol = location.id === activeLocationId;
                return (
                  <td
                    key={location.id}
                    className={cn(
                      "align-middle text-center transition-opacity",
                      isWide ? "px-2 py-2.5" : "px-3 py-2.5",
                      isActiveCol && "bg-brand-tint/40",
                      hasActiveCol && !isActiveCol && "opacity-30",
                    )}
                  >
                    <StatusDot status={status} note={note} size={isWide ? "sm" : "md"} />
                  </td>
                );
              })}
            </tr>
            <AnimatePresence initial={false}>
              {isSelected ? (
                <MatrixExpandRow service={service} locations={locations} totalCols={totalCols} />
              ) : null}
            </AnimatePresence>
          </Fragment>
        );
      })}
    </>
  );
}

function MatrixExpandRow({
  service,
  locations,
  totalCols,
}: {
  service: AvailabilityRecord;
  locations: ReadonlyArray<Location>;
  totalCols: number;
}) {
  const planned = locations.reduce<string[]>((acc, location) => {
    const cell = service.availability[location.id];
    if (cell?.status === "planned" && cell.note && cell.note !== "TBD") acc.push(cell.note);
    return acc;
  }, []);
  const guidance =
    planned.length > 0
      ? `Rollout in progress. Next expected: ${planned[0]}.`
      : locations.some((l) => service.availability[l.id]?.status === "available")
        ? "Available now. Proceed to catalog or onboarding."
        : null;

  return (
    <LazyMotion features={domAnimation}>
      <m.tr
        key={`${service.id}-expand`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="border-b border-border bg-brand-tint/40"
      >
        <td colSpan={totalCols} className="p-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
            {guidance ? (
              <span className="font-mono text-xs leading-5 text-foreground/80">{guidance}</span>
            ) : (
              <span className="font-mono text-xs text-muted-foreground">{service.name}</span>
            )}
            <span className="flex flex-wrap items-center gap-1">
              <MatrixAction primary>Open catalog</MatrixAction>
              <MatrixAction>User guide</MatrixAction>
              <MatrixAction>Onboarding</MatrixAction>
              <MatrixAction>Support</MatrixAction>
            </span>
          </div>
        </td>
      </m.tr>
    </LazyMotion>
  );
}

function MatrixAction({ children, primary }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <Button
      type="button"
      onClick={(event) => event.stopPropagation()}
      variant={primary ? "default" : "outline"}
      size="xs"
      className="font-mono"
    >
      {children}
      {primary ? <IconArrowUpRight aria-hidden className="size-3" /> : null}
    </Button>
  );
}
