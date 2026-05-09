import type {
  AvailabilityRecord,
  Location,
} from "@/api/server/availability";
import { StatusChip, statusLabel } from "@/components/explore/status-chip";
import { cn } from "@/lib/utils";

type MatrixViewProps = {
  locations: ReadonlyArray<Location>;
  groups: ReadonlyArray<readonly [string, ReadonlyArray<AvailabilityRecord>]>;
  onSelect: (id: string) => void;
};

export function MatrixView({ locations, groups, onSelect }: MatrixViewProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-background">
            <th className="sticky top-[52px] z-[5] border-b border-border px-2.5 py-2 text-left font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
              Service
            </th>
            {locations.map((location) => (
              <th
                key={location.id}
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
              onSelect={onSelect}
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
  onSelect,
}: {
  domain: string;
  services: ReadonlyArray<AvailabilityRecord>;
  locations: ReadonlyArray<Location>;
  onSelect: (id: string) => void;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={locations.length + 1}
          className={cn(
            "border-b border-border bg-background px-2.5 py-2",
            "font-mono text-[10px] font-bold uppercase tracking-[0.04em] text-muted-foreground",
          )}
        >
          {domain}
        </td>
      </tr>
      {services.map((service) => (
        <tr
          key={service.id}
          onClick={() => onSelect(service.id)}
          className="cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/50"
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
              <span className="font-semibold text-foreground">{service.name}</span>
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
                  <span className="font-mono text-[11px] text-muted-foreground/70">—</span>
                ) : (
                  <StatusChip status={status} text={text} size="sm" />
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
