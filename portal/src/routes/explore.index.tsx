import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { IconSearch } from "@tabler/icons-react";

import {
  fetchAvailability,
  type AvailabilityRecord,
  type AvailabilityResponse,
  type LocationStatus,
} from "@/api/server/availability";
import { ExpandPanel } from "@/components/explore/expand-panel";
import { MatrixView } from "@/components/explore/matrix-view";
import { RegionStrip } from "@/components/explore/region-strip";
import { ServiceCard } from "@/components/explore/service-card";
import { PageBody } from "@/components/page-section";
import { cn } from "@/lib/utils";

type ViewMode = "cards" | "matrix";

export const Route = createFileRoute("/explore/")({
  loader: async (): Promise<AvailabilityResponse> => fetchAvailability(),
  component: ExploreRoute,
});

const STATUS_OPTIONS: ReadonlyArray<{ value: LocationStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "planned", label: "Planned" },
  { value: "interim", label: "Interim" },
  { value: "not-planned", label: "Not planned" },
];

function ExploreRoute() {
  const { locations, services } = Route.useLoaderData();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LocationStatus | "all">("all");
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [activeLocation, setActiveLocation] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("cards");

  const domainOptions = useMemo(() => {
    const set = new Set(services.map((s) => s.domain));
    return ["all", ...[...set].sort()];
  }, [services]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((service) => {
      if (q) {
        const haystack = `${service.name} ${service.domain} ${service.iconKey}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (domainFilter !== "all" && service.domain !== domainFilter) return false;
      if (statusFilter !== "all") {
        const matches = locations.some(
          (location) => service.availability[location.id]?.status === statusFilter,
        );
        if (!matches) return false;
      }
      if (activeLocation) {
        const cell = service.availability[activeLocation];
        if (!cell || cell.status === "not-planned") return false;
      }
      return true;
    });
  }, [services, query, domainFilter, statusFilter, activeLocation, locations]);

  const groups = useMemo(() => {
    const map = new Map<string, AvailabilityRecord[]>();
    for (const service of filtered) {
      const list = map.get(service.domain);
      if (list) list.push(service);
      else map.set(service.domain, [service]);
    }
    return [...map.entries()] as ReadonlyArray<readonly [string, ReadonlyArray<AvailabilityRecord>]>;
  }, [filtered]);

  const selectedService = filtered.find((s) => s.id === selectedServiceId) ?? null;
  const activeLocationLabel = activeLocation
    ? locations.find((l) => l.id === activeLocation)?.label
    : null;

  function resetSelection() {
    setSelectedServiceId(null);
  }

  function resetAll() {
    setQuery("");
    setStatusFilter("all");
    setDomainFilter("all");
    setActiveLocation(null);
    setSelectedServiceId(null);
  }

  return (
    <PageBody width="wide">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Availability
        </span>
        <h1 className="text-[22px] font-bold tracking-[-0.03em] text-foreground">
          Regional Availability Map
        </h1>
        <p className="max-w-[56ch] text-[13px] leading-6 text-muted-foreground">
          Locate services across STT regions and outposts. Click any service for
          detailed status and next steps.
        </p>
      </header>

      <SearchField
        value={query}
        onChange={(value) => {
          setQuery(value);
          resetSelection();
        }}
      />

      <RegionStrip
        locations={locations}
        services={services}
        active={activeLocation}
        onSelect={(id) => {
          setActiveLocation(id);
          resetSelection();
        }}
      />

      <Controls
        statusFilter={statusFilter}
        onStatusChange={(value) => {
          setStatusFilter(value);
          resetSelection();
        }}
        domainFilter={domainFilter}
        onDomainChange={(value) => {
          setDomainFilter(value);
          resetSelection();
        }}
        domainOptions={domainOptions}
        view={view}
        onViewChange={setView}
        resultsLabel={`${filtered.length} service${filtered.length === 1 ? "" : "s"}${
          activeLocationLabel ? ` in ${activeLocationLabel}` : ""
        }`}
      />

      {filtered.length === 0 ? (
        <EmptyState onReset={resetAll} />
      ) : view === "cards" ? (
        <CardsView
          groups={groups}
          locations={locations}
          selectedServiceId={selectedServiceId}
          onSelect={(id) =>
            setSelectedServiceId((current) => (current === id ? null : id))
          }
          selectedService={selectedService}
        />
      ) : (
        <MatrixView
          locations={locations}
          groups={groups}
          onSelect={(id) => {
            setSelectedServiceId(id);
            setView("cards");
          }}
        />
      )}
    </PageBody>
  );
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label
      className={cn(
        "flex h-9 max-w-[420px] items-center gap-2 rounded-md border border-border bg-card px-2.5",
        "transition-[border-color,box-shadow]",
        "focus-within:border-primary focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_8%,transparent)]",
      )}
    >
      <IconSearch className="size-3.5 text-muted-foreground" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        type="search"
        placeholder="Search services… S3, EKS, Bedrock"
        aria-label="Search services"
        className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function Controls({
  statusFilter,
  onStatusChange,
  domainFilter,
  onDomainChange,
  domainOptions,
  view,
  onViewChange,
  resultsLabel,
}: {
  statusFilter: LocationStatus | "all";
  onStatusChange: (value: LocationStatus | "all") => void;
  domainFilter: string;
  onDomainChange: (value: string) => void;
  domainOptions: ReadonlyArray<string>;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  resultsLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PillSelect
        label="Status"
        value={statusFilter}
        onChange={(value) => onStatusChange(value as LocationStatus | "all")}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </PillSelect>
      <PillSelect
        label="Domain"
        value={domainFilter}
        onChange={onDomainChange}
      >
        {domainOptions.map((domain) => (
          <option key={domain} value={domain}>
            {domain === "all" ? "All domains" : domain}
          </option>
        ))}
      </PillSelect>
      <span className="ml-auto font-mono text-[11px] text-muted-foreground">
        {resultsLabel}
      </span>
      <div
        role="tablist"
        aria-label="View mode"
        className="flex overflow-hidden rounded-md border border-border"
      >
        {(["cards", "matrix"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={view === mode}
            onClick={() => onViewChange(mode)}
            className={cn(
              "px-2.5 py-1 text-[11px] font-semibold transition-colors",
              "border-r border-border last:border-r-0",
              view === mode
                ? "bg-brand-tint text-primary"
                : "bg-card text-muted-foreground hover:bg-muted",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {mode === "cards" ? "Cards" : "Matrix"}
          </button>
        ))}
      </div>
    </div>
  );
}

function PillSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          "h-7 cursor-pointer appearance-none rounded-full border border-border bg-card pl-3 pr-7",
          "text-[12px] font-medium text-muted-foreground transition-colors",
          "hover:border-border-strong",
          "focus:border-primary focus:outline-none",
        )}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 text-[10px] text-muted-foreground"
      >
        ▾
      </span>
    </label>
  );
}

function CardsView({
  groups,
  locations,
  selectedServiceId,
  onSelect,
  selectedService,
}: {
  groups: ReadonlyArray<readonly [string, ReadonlyArray<AvailabilityRecord>]>;
  locations: ReadonlyArray<{ id: string; label: string; sub: string; kind: "region" | "outpost" }>;
  selectedServiceId: string | null;
  onSelect: (id: string) => void;
  selectedService: AvailabilityRecord | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      {groups.map(([domain, services]) => (
        <section key={domain}>
          <div className="sticky top-[52px] z-[5] mb-2 flex items-center gap-2 bg-background py-1">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
              {domain}
            </h3>
            <span
              className={cn(
                "rounded-full bg-border px-1.5 py-px",
                "font-mono text-[10px] font-bold text-muted-foreground",
              )}
            >
              {services.length}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            }}
          >
            {services.map((service) => (
              <Fragment key={service.id}>
                <ServiceCard
                  service={service}
                  locations={locations}
                  selected={selectedServiceId === service.id}
                  onSelect={() => onSelect(service.id)}
                />
                {selectedServiceId === service.id && selectedService ? (
                  <ExpandPanel
                    service={selectedService}
                    locations={locations}
                    onClose={() => onSelect(service.id)}
                  />
                ) : null}
              </Fragment>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <p className="text-[14px] font-bold text-foreground">No services match</p>
      <p className="text-[12px] text-muted-foreground">
        Broaden your search or clear filters.
      </p>
      <button
        type="button"
        onClick={onReset}
        className={cn(
          "mt-2 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground",
          "transition-colors hover:bg-primary/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        Reset filters
      </button>
    </div>
  );
}
