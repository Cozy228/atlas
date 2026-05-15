import { Fragment, useMemo, useReducer } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { IconLayoutGrid, IconTable } from "@tabler/icons-react";
import Fuse from "fuse.js";

import { availabilityQueryOptions } from "@/api/queries";
import {
  type AvailabilityRecord,
  type LandingZoneId,
  type LocationStatus,
} from "@/api/server/availability";
import { ExpandPanel } from "@/components/explore/expand-panel";
import { MatrixView } from "@/components/explore/matrix-view";
import { RegionStrip } from "@/components/explore/region-strip";
import { ServiceCard } from "@/components/explore/service-card";
import { PageBody } from "@/components/page-section";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CatalogSearchField } from "@/components/catalog-search-field";
import { cn } from "@/lib/utils";

type ViewMode = "cards" | "matrix";

export const Route = createFileRoute("/availability/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(availabilityQueryOptions),
  component: AvailabilityRoute,
});

const STATUS_OPTIONS: ReadonlyArray<{ value: LocationStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "planned", label: "Planned" },
  { value: "interim", label: "Interim" },
  { value: "not-planned", label: "Not planned" },
];

type ExploreState = {
  zone: LandingZoneId;
  query: string;
  statusFilter: LocationStatus | "all";
  domainFilter: string;
  activeLocation: string | null;
  selectedServiceId: string | null;
  view: ViewMode;
};

type ExploreAction =
  | { type: "setZone"; value: LandingZoneId }
  | { type: "setQuery"; value: string }
  | { type: "setStatusFilter"; value: LocationStatus | "all" }
  | { type: "setDomainFilter"; value: string }
  | { type: "setActiveLocation"; value: string | null }
  | { type: "setView"; value: ViewMode }
  | { type: "toggleSelection"; id: string }
  | { type: "resetAll" };

const INITIAL_EXPLORE_STATE: ExploreState = {
  zone: "aws",
  activeLocation: null,
  domainFilter: "all",
  query: "",
  selectedServiceId: null,
  statusFilter: "all",
  view: "matrix",
};

function exploreReducer(state: ExploreState, action: ExploreAction): ExploreState {
  switch (action.type) {
    case "setZone":
      return {
        ...INITIAL_EXPLORE_STATE,
        zone: action.value,
        view: state.view,
      };
    case "setQuery":
      return { ...state, query: action.value, selectedServiceId: null };
    case "setStatusFilter":
      return { ...state, statusFilter: action.value, selectedServiceId: null };
    case "setDomainFilter":
      return { ...state, domainFilter: action.value, selectedServiceId: null };
    case "setActiveLocation":
      return { ...state, activeLocation: action.value, selectedServiceId: null };
    case "setView":
      return { ...state, view: action.value };
    case "toggleSelection":
      return {
        ...state,
        selectedServiceId: state.selectedServiceId === action.id ? null : action.id,
      };
    case "resetAll":
      return { ...INITIAL_EXPLORE_STATE, zone: state.zone };
  }
}

function AvailabilityRoute() {
  const {
    data: { zones },
  } = useSuspenseQuery(availabilityQueryOptions);
  const [state, dispatch] = useReducer(exploreReducer, INITIAL_EXPLORE_STATE);
  const {
    zone: activeZoneId,
    query,
    statusFilter,
    domainFilter,
    activeLocation,
    selectedServiceId,
    view,
  } = state;

  const activeZone = zones.find((z) => z.id === activeZoneId) ?? zones[0]!;
  const { locations, services } = activeZone;

  const domainOptions = useMemo(() => {
    const set = new Set(services.map((s) => s.domain));
    return ["all", ...[...set].toSorted()];
  }, [services]);

  const fuse = useMemo(
    () =>
      new Fuse(services as ReadonlyArray<AvailabilityRecord>, {
        keys: ["name", "domain", "iconKey"],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [services],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    const matched = q.length > 0 ? fuse.search(q).map((result) => result.item) : services;
    return matched.filter((service) => {
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
  }, [fuse, services, query, domainFilter, statusFilter, activeLocation, locations]);

  const groups = useMemo(() => {
    const map = new Map<string, AvailabilityRecord[]>();
    for (const service of filtered) {
      const list = map.get(service.domain);
      if (list) list.push(service);
      else map.set(service.domain, [service]);
    }
    return [...map.entries()] as ReadonlyArray<
      readonly [string, ReadonlyArray<AvailabilityRecord>]
    >;
  }, [filtered]);

  const selectedService = filtered.find((s) => s.id === selectedServiceId) ?? null;
  const activeLocationLabel = activeLocation
    ? locations.find((l) => l.id === activeLocation)?.label
    : null;

  function toggleSelection(id: string) {
    dispatch({ type: "toggleSelection", id });
  }

  return (
    <PageBody width="comfortable">
      <Hero searchValue={query} onSearchChange={(value) => dispatch({ type: "setQuery", value })} />

      <Section
        eyebrow="Catalog"
        title="Services"
        description="Filter by region, status, or domain. Click any service for next steps."
      >
        <ZoneSwitcher
          active={activeZoneId}
          onChange={(value) => dispatch({ type: "setZone", value })}
        />

        <Controls
          locations={locations}
          services={services}
          activeLocation={activeLocation}
          onLocationChange={(value) => dispatch({ type: "setActiveLocation", value })}
          statusFilter={statusFilter}
          onStatusChange={(value) => dispatch({ type: "setStatusFilter", value })}
          domainFilter={domainFilter}
          onDomainChange={(value) => {
            dispatch({ type: "setDomainFilter", value });
          }}
          domainOptions={domainOptions}
          view={view}
          onViewChange={(value) => dispatch({ type: "setView", value })}
          resultsLabel={`${filtered.length} service${filtered.length === 1 ? "" : "s"}${
            activeLocationLabel ? ` in ${activeLocationLabel}` : ""
          }`}
        />

        {filtered.length === 0 ? (
          <EmptyState onReset={() => dispatch({ type: "resetAll" })} />
        ) : view === "cards" ? (
          <CardsView
            groups={groups}
            locations={locations}
            selectedServiceId={selectedServiceId}
            onSelect={toggleSelection}
            selectedService={selectedService}
          />
        ) : (
          <MatrixView
            locations={locations}
            groups={groups}
            selectedServiceId={selectedServiceId}
            onSelect={toggleSelection}
            activeLocationId={activeLocation}
            onLocationSelect={(id) => dispatch({ type: "setActiveLocation", value: id })}
          />
        )}
      </Section>
    </PageBody>
  );
}

function Hero({
  searchValue,
  onSearchChange,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          Availability
        </span>
        <h1 className="type-display font-semibold leading-[1.1] tracking-[-0.03em] text-foreground sm:type-display-lg">
          Regional availability map
        </h1>
        <p className="max-w-[52ch] type-body leading-[1.6] text-muted-foreground">
          Locate services across regions and outposts. Click any service for detailed status and
          next steps.
        </p>
      </div>
      <SearchField value={searchValue} onChange={onSearchChange} />
    </div>
  );
}

const ZONE_META: Record<LandingZoneId, { label: string; sub: string }> = {
  aws: { label: "AWS", sub: "5 regions · 27 services" },
  azure: { label: "Azure", sub: "10 regions · 30 services" },
};

function ZoneSwitcher({
  active,
  onChange,
}: {
  active: LandingZoneId;
  onChange: (zone: LandingZoneId) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Landing zone"
      className="inline-flex w-fit rounded-lg border border-border bg-muted p-1"
    >
      {(["aws", "azure"] as const).map((zoneId) => {
        const isActive = zoneId === active;
        const meta = ZONE_META[zoneId];
        return (
          <button
            key={zoneId}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(zoneId)}
            className={cn(
              "flex flex-col gap-0.5 rounded-md px-5 py-2 text-left transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive ? "bg-background shadow-sm" : "bg-transparent hover:bg-background/50",
            )}
          >
            <span
              className={cn(
                "text-sm font-bold tracking-[-0.01em]",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {meta.label}
            </span>
            <span
              className={cn(
                "font-mono type-chip",
                isActive ? "text-muted-foreground" : "text-muted-foreground/60",
              )}
            >
              {meta.sub}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-col gap-1.5">
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
          {eyebrow}
        </span>
        <h2 className="type-section font-semibold tracking-[-0.03em] text-foreground">{title}</h2>
        {description ? (
          <p className="max-w-[52ch] text-sm leading-6 text-muted-foreground">{description}</p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <CatalogSearchField
      value={value}
      onChange={onChange}
      placeholder="Search services… S3, EKS, Bedrock"
    />
  );
}

function Controls({
  locations,
  services,
  activeLocation,
  onLocationChange,
  statusFilter,
  onStatusChange,
  domainFilter,
  onDomainChange,
  domainOptions,
  view,
  onViewChange,
  resultsLabel,
}: {
  locations: ReadonlyArray<{ id: string; label: string; sub: string; kind: "region" | "outpost" }>;
  services: ReadonlyArray<AvailabilityRecord>;
  activeLocation: string | null;
  onLocationChange: (id: string | null) => void;
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
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <RegionStrip
        locations={locations}
        services={services}
        active={activeLocation}
        onSelect={onLocationChange}
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Select
            value={statusFilter}
            onValueChange={(value) => onStatusChange(value as LocationStatus | "all")}
          >
            <SelectTrigger size="sm" aria-label="Status" className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Domain</span>
          <Select
            value={domainFilter}
            onValueChange={(value) => {
              if (value) onDomainChange(value);
            }}
          >
            <SelectTrigger size="sm" aria-label="Domain" className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {domainOptions.map((domain) => (
                <SelectItem key={domain} value={domain}>
                  {domain === "all" ? "All domains" : domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="ml-auto font-mono text-xs text-muted-foreground">{resultsLabel}</span>

        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(value) => {
            if (value === "cards" || value === "matrix") onViewChange(value);
          }}
          size="sm"
          spacing={1}
          aria-label="View mode"
          className="gap-0.5 rounded-lg bg-muted p-0.5"
        >
          <ToggleGroupItem
            value="cards"
            className="rounded-md border-0 bg-transparent text-xs font-semibold aria-pressed:bg-background aria-pressed:shadow-sm"
          >
            <IconLayoutGrid className="size-3.5" data-icon="inline-start" />
            Cards
          </ToggleGroupItem>
          <ToggleGroupItem
            value="matrix"
            className="rounded-md border-0 bg-transparent text-xs font-semibold aria-pressed:bg-background aria-pressed:shadow-sm"
          >
            <IconTable className="size-3.5" data-icon="inline-start" />
            Matrix
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
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
          <div className="sticky top-14 z-[5] mb-2 flex items-center gap-2 bg-background py-1">
            <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              {domain}
            </h3>
            <span
              className={cn(
                "rounded-full bg-border px-1.5 py-px",
                "font-mono text-xs font-bold text-muted-foreground",
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
      <p className="text-sm font-bold text-foreground">No services match</p>
      <p className="text-xs text-muted-foreground">Broaden your search or clear filters.</p>
      <Button type="button" size="sm" onClick={onReset} className="mt-2">
        Reset filters
      </Button>
    </div>
  );
}
