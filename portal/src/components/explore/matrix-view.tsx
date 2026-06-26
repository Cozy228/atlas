import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
} from "@tanstack/react-table";
import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { IconArrowUpRight, IconChevronDown } from "@tabler/icons-react";

import type { AvailabilityRecord, Location } from "@/api/server/availability";
import { ServiceIcon } from "@/components/explore/service-icon";
import type { ServiceIconProvider } from "@/components/explore/service-icon";
import { StatusDot } from "@/components/explore/status-dot";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AvailabilityRow, AvailabilityRowGroup } from "@/lib/availability-row-model";
import { cn } from "@/lib/utils";

type MatrixViewProps = {
  provider: ServiceIconProvider;
  locations: ReadonlyArray<Location>;
  rows: ReadonlyArray<AvailabilityRow>;
  groups: ReadonlyArray<AvailabilityRowGroup>;
  selectedServiceId: string | null;
  onSelect: (id: string) => void;
  activeLocationId: string | null;
  onLocationSelect: (id: string) => void;
};

export function MatrixView({
  provider,
  locations,
  rows,
  groups,
  selectedServiceId,
  onSelect,
  activeLocationId,
  onLocationSelect,
}: MatrixViewProps) {
  const totalCols = locations.length + 1;
  const isWide = locations.length > 6;
  // Columns share the container width by percentage; every region fits.
  const svcColWidth = isWide ? "20%" : "26%";
  const locColWidth = `${(100 - parseFloat(svcColWidth)) / locations.length}%`;
  const hasActiveCol = activeLocationId !== null;
  const tableData = useMemo(() => [...rows], [rows]);
  const columns = useMemo<ColumnDef<AvailabilityRow>[]>(
    () => [
      {
        id: "service",
        header: () => "Service",
        cell: ({ row }) => <ServiceCell provider={provider} service={row.original.service} />,
      },
      ...locations.map<ColumnDef<AvailabilityRow>>((location) => {
        return {
          id: location.id,
          header: () => (
            <button
              type="button"
              onClick={() => onLocationSelect(location.id)}
              className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-inherit transition-colors hover:text-foreground"
            >
              <span className="max-w-full font-sans text-xs font-semibold normal-case leading-tight tracking-normal text-foreground">
                {location.label}
              </span>
              {/* The region code only fits comfortably when there are few
                  columns; in dense zones the short name carries the header. */}
              {!isWide ? (
                <span className="max-w-full font-mono text-[0.625rem] font-normal lowercase leading-tight tracking-normal text-muted-foreground">
                  {location.id}
                </span>
              ) : null}
            </button>
          ),
          cell: ({ row }) => (
            <AvailabilityCell service={row.original.service} location={location} isWide={isWide} />
          ),
        };
      }),
    ],
    // Selection/active-column state is intentionally NOT a dependency: baking it
    // in rebuilt every column (all ~354 cells re-rendered) on each select. Those
    // states are now CSS-driven (chevron) or applied at render time (active col).
    [isWide, locations, onLocationSelect, provider],
  );
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });
  const tableRowsById = new Map(table.getRowModel().rows.map((row) => [row.original.id, row]));

  return (
    <div className="rounded-lg border border-border bg-card">
      <table data-slot="table" className="w-full table-fixed border-collapse type-detail">
        <colgroup>
          <col style={{ width: svcColWidth }} />
          {locations.map((location) => (
            <col key={location.id} style={{ width: locColWidth }} />
          ))}
        </colgroup>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  scope="col"
                  colSpan={header.colSpan}
                  className={matrixHeadClass(header.column.id, activeLocationId)}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <DomainRows
              key={group.domain}
              domain={group.domain}
              rows={group.rowIds.map((id) => tableRowsById.get(id)).filter(isTableRow)}
              locations={locations}
              selectedServiceId={selectedServiceId}
              onSelect={onSelect}
              totalCols={totalCols}
              isWide={isWide}
              activeLocationId={activeLocationId}
              hasActiveCol={hasActiveCol}
            />
          ))}
        </TableBody>
      </table>
    </div>
  );
}

function DomainRows({
  domain,
  rows,
  locations,
  selectedServiceId,
  onSelect,
  totalCols,
  isWide,
  activeLocationId,
  hasActiveCol,
}: {
  domain: string;
  rows: ReadonlyArray<Row<AvailabilityRow>>;
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
      <TableRow className="hover:bg-transparent">
        <TableCell
          colSpan={totalCols}
          className={cn(
            "border-b border-border px-3 py-2.5",
            "font-mono text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground",
          )}
        >
          {domain}
        </TableCell>
      </TableRow>
      {rows.map((row) => (
        <MatrixRow
          key={row.original.id}
          row={row}
          isSelected={row.original.id === selectedServiceId}
          locations={locations}
          onSelect={onSelect}
          totalCols={totalCols}
          isWide={isWide}
          activeLocationId={activeLocationId}
          hasActiveCol={hasActiveCol}
        />
      ))}
    </>
  );
}

/**
 * A single service row + its expand panel, split into its own component so the
 * React Compiler memoises it per-row: toggling one service only re-renders the
 * rows whose `isSelected` actually flipped — the other ~50 rows (and their real
 * service icons) stay untouched. This is the fix for the "one select re-renders
 * all ~354 cells" storm, now that `columns` are static (the table never rebuilds
 * its cell render fns).
 */
function MatrixRow({
  row,
  isSelected,
  locations,
  onSelect,
  totalCols,
  isWide,
  activeLocationId,
  hasActiveCol,
}: {
  row: Row<AvailabilityRow>;
  isSelected: boolean;
  locations: ReadonlyArray<Location>;
  onSelect: (id: string) => void;
  totalCols: number;
  isWide: boolean;
  activeLocationId: string | null;
  hasActiveCol: boolean;
}) {
  const { service } = row.original;
  return (
    <>
      <TableRow
        onClick={() => onSelect(row.original.id)}
        data-selected={isSelected ? "true" : undefined}
        className={cn(
          "group cursor-pointer border-b border-border last:border-b-0 transition-colors",
          "hover:bg-muted/50",
          "data-[selected=true]:bg-brand-tint",
          // Skip layout/paint of off-screen rows so only visible icons paint on first
          // open of each tab. intrinsic-size reserves height to keep the scrollbar stable.
          "[content-visibility:auto] [contain-intrinsic-size:auto_44px]",
        )}
        aria-expanded={isSelected}
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell
            key={cell.id}
            className={matrixCellClass(cell.column.id, activeLocationId, isWide, hasActiveCol)}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
      <AnimatePresence initial={false}>
        {isSelected ? (
          <MatrixExpandRow service={service} locations={locations} totalCols={totalCols} />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function ServiceCell({
  provider,
  service,
}: {
  provider: ServiceIconProvider;
  service: AvailabilityRecord;
}) {
  return (
    <span className="flex w-full min-w-0 items-center gap-2">
      <ServiceIcon serviceId={service.id} provider={provider} size="sm" />
      <span className="min-w-0 flex-1 whitespace-normal font-semibold leading-tight text-foreground [overflow-wrap:anywhere]">
        {service.name}
      </span>
      <IconChevronDown
        aria-hidden
        className={cn(
          "size-3 shrink-0 text-muted-foreground transition-transform",
          // Driven by the row's `data-selected` so toggling a service is pure CSS
          // (no cell re-render). The row carries `group` + `data-selected`.
          "group-data-[selected=true]:rotate-180 group-data-[selected=true]:text-primary",
        )}
      />
    </span>
  );
}

function AvailabilityCell({
  service,
  location,
  isWide,
}: {
  service: AvailabilityRecord;
  location: Location;
  isWide: boolean;
}) {
  const cell = service.availability[location.id];
  const status = cell?.status ?? "not-planned";
  const note =
    status === "planned" && cell?.note
      ? `ETA ${cell.note}`
      : status === "interim" && cell?.note
        ? cell.note
        : location.label;

  return <StatusDot status={status} note={note} size={isWide ? "sm" : "md"} />;
}

function matrixHeadClass(columnId: string, activeLocationId: string | null) {
  const isServiceColumn = columnId === "service";
  const isActive = columnId === activeLocationId;
  return cn(
    // Header pins just below the 56px top bar.
    "sticky top-14 z-20 border-b border-border bg-background",
    "font-mono text-xs font-bold uppercase tracking-[0.04em] text-muted-foreground",
    isServiceColumn && "px-3 py-2.5 text-left",
    !isServiceColumn && "cursor-pointer select-none px-2 py-2 align-bottom transition-colors",
    isActive && "bg-brand-tint text-primary",
  );
}

function isTableRow(row: Row<AvailabilityRow> | undefined): row is Row<AvailabilityRow> {
  return row !== undefined;
}

function matrixCellClass(
  columnId: string,
  activeLocationId: string | null,
  isWide: boolean,
  hasActiveCol: boolean,
) {
  const isServiceColumn = columnId === "service";
  const isActiveCol = columnId === activeLocationId;
  return cn(
    isServiceColumn && "px-3 py-2.5 align-middle",
    !isServiceColumn && "align-middle text-center transition-opacity",
    !isServiceColumn && (isWide ? "px-2 py-2.5" : "px-3 py-2.5"),
    isActiveCol && "bg-brand-tint/40",
    hasActiveCol && !isActiveCol && !isServiceColumn && "opacity-30",
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
