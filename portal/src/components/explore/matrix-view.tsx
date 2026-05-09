import { Fragment } from "react";
import { IconArrowUpRight, IconChevronDown } from "@tabler/icons-react";

import type {
  AvailabilityRecord,
  Location,
} from "@/api/server/availability";
import { StatusChip, statusLabel } from "@/components/explore/status-chip";
import { cn } from "@/lib/utils";

type MatrixViewProps = {
  locations: ReadonlyArray<Location>;
  groups: ReadonlyArray<readonly [string, ReadonlyArray<AvailabilityRecord>]>;
  selectedServiceId: string | null;
  onSelect: (id: string) => void;
};

export function MatrixView({
  locations,
  groups,
  selectedServiceId,
  onSelect,
}: MatrixViewProps) {
  const totalCols = locations.length + 1;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-background">
            <th
              scope="col"
              className="sticky top-[52px] z-[5] border-b border-border px-2.5 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground"
            >
              Service
            </th>
            {locations.map((location) => (
              <th
                key={location.id}
                scope="col"
                className="sticky top-[52px] z-[5] border-b border-border px-2.5 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground"
              >
                {location.label}
              </th>
            ))}
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
}: {
  domain: string;
  services: ReadonlyArray<AvailabilityRecord>;
  locations: ReadonlyArray<Location>;
  selectedServiceId: string | null;
  onSelect: (id: string) => void;
  totalCols: number;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={totalCols}
          className={cn(
            "border-b border-border bg-background px-2.5 py-2",
            "font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground",
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
              <td className="px-2.5 py-2">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 items-center justify-center rounded border border-border bg-background",
                      "font-mono text-[7px] font-bold uppercase text-primary",
                    )}
                  >
                    {service.iconKey}
                  </span>
                  <span className="font-semibold text-foreground">
                    {service.name}
                  </span>
                  <IconChevronDown
                    aria-hidden
                    className={cn(
                      "ml-auto size-3 text-muted-foreground transition-transform",
                      isSelected && "rotate-180 text-primary",
                    )}
                  />
                </span>
              </td>
              {locations.map((location) => {
                const cell = service.availability[location.id];
                const status = cell?.status ?? "not-planned";
                const text =
                  status === "not-planned"
                    ? "—"
                    : status === "planned" && cell?.note
                      ? `${statusLabel(status)} ${cell.note}`
                      : statusLabel(status);
                return (
                  <td key={location.id} className="px-2.5 py-2">
                    {status === "not-planned" ? (
                      <span className="font-mono text-[11px] text-muted-foreground/70">
                        —
                      </span>
                    ) : (
                      <StatusChip status={status} text={text} size="sm" />
                    )}
                  </td>
                );
              })}
            </tr>
            {isSelected ? (
              <MatrixExpandRow
                service={service}
                locations={locations}
                totalCols={totalCols}
              />
            ) : null}
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
  const planned = locations
    .map((location) => service.availability[location.id])
    .filter(
      (cell) => cell?.status === "planned" && cell.note && cell.note !== "TBD",
    )
    .map((cell) => cell!.note!);
  const guidance =
    planned.length > 0
      ? `Rollout in progress. Next expected: ${planned[0]}.`
      : locations.some(
            (l) => service.availability[l.id]?.status === "available",
          )
        ? "Available now. Proceed to catalog or onboarding."
        : null;

  return (
    <tr
      className={cn(
        "border-b border-border bg-brand-tint/40",
        "[animation:expandRowIn_180ms_cubic-bezier(0.22,1,0.36,1)]",
      )}
    >
      <td colSpan={totalCols} className="px-2.5 py-2.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {guidance ? (
            <span className="font-mono text-[11px] text-foreground/80">
              {guidance}
            </span>
          ) : null}
          <span className="ml-auto flex flex-wrap items-center gap-1">
            <MatrixAction primary>Open catalog</MatrixAction>
            <MatrixAction>User guide</MatrixAction>
            <MatrixAction>Onboarding</MatrixAction>
            <MatrixAction>Support</MatrixAction>
          </span>
        </div>
        <style>{`@keyframes expandRowIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
      </td>
    </tr>
  );
}

function MatrixAction({
  children,
  primary,
}: {
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[11px] font-semibold transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
      {primary ? (
        <IconArrowUpRight aria-hidden className="size-3" />
      ) : null}
    </button>
  );
}
