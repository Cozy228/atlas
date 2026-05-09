import { Fragment } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IconArrowUpRight, IconChevronDown } from "@tabler/icons-react";

import type {
  AvailabilityRecord,
  Location,
} from "@/api/server/availability";
import { StatusChip, statusLabel } from "@/components/explore/status-chip";
import { Button } from "@/components/ui/button";
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
    <div className="overflow-clip rounded-lg border border-border bg-card">
      <table className="w-full table-fixed border-collapse text-[12px]">
        <colgroup>
          <col style={{ width: "30%" }} />
          {locations.map((location) => (
            <col
              key={location.id}
              style={{ width: `${70 / locations.length}%` }}
            />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th
              scope="col"
              className={cn(
                "sticky top-[52px] z-20 border-b border-border bg-background px-2.5 py-2 text-left",
                "font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground",
              )}
            >
              Service
            </th>
            {locations.map((location) => (
              <th
                key={location.id}
                scope="col"
                className={cn(
                  "sticky top-[52px] z-20 whitespace-nowrap border-b border-border bg-background px-2.5 py-2 text-left",
                  "font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground",
                )}
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
              <td className="px-2.5 py-2 align-middle">
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border border-border bg-background",
                      "font-mono text-[7px] font-bold uppercase text-primary",
                    )}
                  >
                    {service.iconKey}
                  </span>
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
                const text =
                  status === "not-planned"
                    ? "—"
                    : status === "planned" && cell?.note
                      ? `${statusLabel(status)} ${cell.note}`
                      : statusLabel(status);
                return (
                  <td
                    key={location.id}
                    className="whitespace-nowrap px-2.5 py-2 align-middle"
                  >
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
            <AnimatePresence initial={false}>
              {isSelected ? (
                <MatrixExpandRow
                  service={service}
                  locations={locations}
                  totalCols={totalCols}
                />
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
    <motion.tr
      key={`${service.id}-expand`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-border bg-brand-tint/40"
    >
      <td colSpan={totalCols} className="px-3 py-2.5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
          {guidance ? (
            <span className="font-mono text-[11px] leading-5 text-foreground/80">
              {guidance}
            </span>
          ) : (
            <span className="font-mono text-[11px] text-muted-foreground">
              {service.name}
            </span>
          )}
          <span className="flex flex-wrap items-center gap-1">
            <MatrixAction primary>Open catalog</MatrixAction>
            <MatrixAction>User guide</MatrixAction>
            <MatrixAction>Onboarding</MatrixAction>
            <MatrixAction>Support</MatrixAction>
          </span>
        </div>
      </td>
    </motion.tr>
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
    <Button
      type="button"
      onClick={(event) => event.stopPropagation()}
      variant={primary ? "default" : "outline"}
      size="xs"
      className="font-mono"
    >
      {children}
      {primary ? (
        <IconArrowUpRight aria-hidden className="size-3" />
      ) : null}
    </Button>
  );
}
