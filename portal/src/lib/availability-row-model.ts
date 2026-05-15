import Fuse from "fuse.js";

import type { AvailabilityRecord, Location, LocationStatus } from "@/api/server/availability";

export type AvailabilityStatusFilter = LocationStatus | "all";

export type AvailabilityRow = {
  id: string;
  domain: string;
  service: AvailabilityRecord;
  activeLocations: ReadonlyArray<Location>;
};

export type AvailabilityRowGroup = {
  domain: string;
  rowIds: ReadonlyArray<string>;
};

export type AvailabilityRowModel = {
  rows: ReadonlyArray<AvailabilityRow>;
  rowById: ReadonlyMap<string, AvailabilityRow>;
  groups: ReadonlyArray<AvailabilityRowGroup>;
  selectedRow: AvailabilityRow | null;
  domainOptions: ReadonlyArray<string>;
  activeLocationLabel: string | null;
};

type AvailabilityRowModelInput = {
  locations: ReadonlyArray<Location>;
  services: ReadonlyArray<AvailabilityRecord>;
  query: string;
  statusFilter: AvailabilityStatusFilter;
  domainFilter: string;
  activeLocationId: string | null;
  selectedServiceId: string | null;
};

export function buildAvailabilityRowModel({
  locations,
  services,
  query,
  statusFilter,
  domainFilter,
  activeLocationId,
  selectedServiceId,
}: AvailabilityRowModelInput): AvailabilityRowModel {
  const domainOptions = buildDomainOptions(services);
  const activeLocationLabel = activeLocationId
    ? (locations.find((location) => location.id === activeLocationId)?.label ?? null)
    : null;
  const matched = matchServices(services, query);
  const rows = matched
    .filter((service) =>
      matchesFilters({ service, locations, statusFilter, domainFilter, activeLocationId }),
    )
    .map((service) => buildRow(service, locations));
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const groups = groupRows(rows);
  const selectedRow = selectedServiceId ? (rowById.get(selectedServiceId) ?? null) : null;

  return {
    rows,
    rowById,
    groups,
    selectedRow,
    domainOptions,
    activeLocationLabel,
  };
}

function buildDomainOptions(services: ReadonlyArray<AvailabilityRecord>) {
  const domains = new Set(services.map((service) => service.domain));
  return ["all", ...[...domains].toSorted()];
}

function matchServices(services: ReadonlyArray<AvailabilityRecord>, query: string) {
  const q = query.trim();
  if (q.length === 0) return services;

  const fuse = new Fuse(services as ReadonlyArray<AvailabilityRecord>, {
    keys: ["name", "domain", "iconKey"],
    threshold: 0.35,
    ignoreLocation: true,
  });

  return fuse.search(q).map((result) => result.item);
}

function matchesFilters({
  service,
  locations,
  statusFilter,
  domainFilter,
  activeLocationId,
}: {
  service: AvailabilityRecord;
  locations: ReadonlyArray<Location>;
  statusFilter: AvailabilityStatusFilter;
  domainFilter: string;
  activeLocationId: string | null;
}) {
  if (domainFilter !== "all" && service.domain !== domainFilter) return false;

  if (statusFilter !== "all") {
    const matches = locations.some(
      (location) => service.availability[location.id]?.status === statusFilter,
    );
    if (!matches) return false;
  }

  if (activeLocationId) {
    const cell = service.availability[activeLocationId];
    if (!cell || cell.status === "not-planned") return false;
  }

  return true;
}

function buildRow(
  service: AvailabilityRecord,
  locations: ReadonlyArray<Location>,
): AvailabilityRow {
  return {
    id: service.id,
    domain: service.domain,
    service,
    activeLocations: locations.filter((location) => {
      const cell = service.availability[location.id];
      return cell && cell.status !== "not-planned";
    }),
  };
}

function groupRows(rows: ReadonlyArray<AvailabilityRow>) {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.domain);
    if (list) list.push(row.id);
    else map.set(row.domain, [row.id]);
  }
  return [...map.entries()].map(([domain, rowIds]) => ({ domain, rowIds }));
}
