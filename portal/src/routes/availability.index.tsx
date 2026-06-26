/**
 * Regions — world map + per-region detail + service availability matrix.
 *
 * A production candidate to replace the mainline `/availability` surface. It
 * runs on the real availability projection (`availabilityQueryOptions`) and
 * reuses the shared matrix, row model, status dots and service icons. The world
 * map ships with ZERO runtime map dependencies: it draws a precomputed land
 * silhouette (see `components/explore/world-geo.ts`) and projects markers with a
 * plain equirectangular transform.
 */
import {
  Suspense,
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { IconMap, IconMapPin, IconTable } from "@tabler/icons-react";

import { availabilityQueryOptions } from "@/api/queries";
import type { LandingZoneId, Location, LocationStatus } from "@/api/server/availability";
import { MatrixView } from "@/components/explore/matrix-view";
import { RegionMap, regionLabel, type RegionHealth } from "@/components/explore/region-map";
import {
  RegionDetail,
  type RegionMaintenance,
  type RegionStats,
} from "@/components/explore/region-detail";
import {
  preloadAwsServiceIcons,
  preloadAzureServiceIcons,
} from "@/components/explore/service-icon";
import { PageBody, PageHeader } from "@/components/page-section";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildAvailabilityRowModel } from "@/lib/availability-row-model";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/availability/")({
  loader: ({ context }) => {
    // Warm the default-zone icon pack before render so the deferred matrix mounts
    // with real icons in a single commit (no glyph→real upgrade). Client-only: on
    // the server the chunk is already bundled, so warming it does nothing useful.
    if (typeof window !== "undefined") preloadAwsServiceIcons();
    // Warm the availability cache WITHOUT blocking navigation (no return/await).
    // The real projection is a live Confluence fetch + parse, so awaiting it here
    // would freeze on the click; instead the body suspends on the query and shows
    // AvailabilitySkeleton until it lands.
    void context.queryClient.ensureQueryData(availabilityQueryOptions);
  },
  component: RegionsRoute,
});

type ViewMode = "map" | "matrix";

const STATUS_OPTIONS: ReadonlyArray<{ value: LocationStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "available", label: "Available" },
  { value: "interim", label: "Limited" },
  { value: "planned", label: "Planned" },
  { value: "not-planned", label: "Not planned" },
];

/** Fictional, public-safe maintenance windows keyed by location id. */
const MAINTENANCE: Record<string, RegionMaintenance> = {
  northeurope: {
    window: "Jun 14 · 02:00–04:00 UTC",
    detail: "Network fabric upgrade. Brief zonal failovers expected.",
  },
  eastasia: {
    window: "Jun 18 · 16:00–18:00 UTC",
    detail: "Storage scale-unit maintenance. No customer action required.",
  },
  dc16: {
    window: "Jun 21 · 22:00–23:30 UTC",
    detail: "DR outpost firmware patch. Replication paused during the window.",
  },
};

const ZONE_META: Record<LandingZoneId, { label: string; sub: string }> = {
  aws: { label: "AWS", sub: "5 regions" },
  azure: { label: "Azure", sub: "10 regions" },
};

type State = {
  zone: LandingZoneId;
  selectedLocationId: string | null;
  selectedServiceId: string | null;
  view: ViewMode;
  statusFilter: LocationStatus | "all";
  domainFilter: string;
  serviceFilter: string;
};

type Action =
  | { type: "setZone"; value: LandingZoneId }
  | { type: "selectLocation"; value: string | null }
  | { type: "toggleLocation"; id: string }
  | { type: "toggleService"; id: string }
  | { type: "setView"; value: ViewMode }
  | { type: "setStatus"; value: LocationStatus | "all" }
  | { type: "setDomain"; value: string }
  | { type: "setService"; value: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "setZone":
      return {
        ...state,
        zone: action.value,
        selectedLocationId: null,
        selectedServiceId: null,
        // Service ids are zone-specific, so the filter resets with the zone.
        serviceFilter: "all",
      };
    case "selectLocation":
      return { ...state, selectedLocationId: action.value };
    case "toggleLocation":
      return {
        ...state,
        selectedLocationId: state.selectedLocationId === action.id ? null : action.id,
      };
    case "toggleService":
      return {
        ...state,
        selectedServiceId: state.selectedServiceId === action.id ? null : action.id,
      };
    case "setView":
      return { ...state, view: action.value };
    case "setStatus":
      return { ...state, statusFilter: action.value, selectedServiceId: null };
    case "setDomain":
      return { ...state, domainFilter: action.value, selectedServiceId: null };
    case "setService":
      return { ...state, serviceFilter: action.value, selectedServiceId: null };
  }
}

function RegionsRoute() {
  // Suspense boundary so navigation is instant: the body suspends on the
  // (live-fetched) projection and AvailabilitySkeleton holds the layout until
  // it resolves. The post-data matrix mount is deferred separately below.
  return (
    <Suspense fallback={<AvailabilitySkeleton />}>
      <RegionsContent />
    </Suspense>
  );
}

function RegionsContent() {
  const {
    data: { zones },
  } = useSuspenseQuery(availabilityQueryOptions);

  const [state, dispatch] = useReducer(reducer, {
    zone: "aws",
    selectedLocationId: null,
    selectedServiceId: null,
    view: "map",
    statusFilter: "all",
    domainFilter: "all",
    serviceFilter: "all",
  });

  const zone = zones.find((z) => z.id === state.zone) ?? zones[0]!;
  const { locations, services } = zone;
  // Selection is optional: no region is selected until the user picks one, and
  // clicking the active region clears it again.
  const selected = locations.find((l) => l.id === state.selectedLocationId) ?? null;

  useEffect(() => {
    // Warm the active zone's icon pack so the matrix keeps its real icons on
    // first paint (AWS is the default zone, so this preloads AWS on mount).
    if (state.zone === "azure") preloadAzureServiceIcons();
    else preloadAwsServiceIcons();
  }, [state.zone]);

  // Defer mounting the ~50-row × N-region matrix (hundreds of cells + brand
  // icons) until after the route shell + map have painted. The cold nav commit
  // is otherwise one long task that freezes the main thread; splitting the matrix
  // into a post-paint transition lets the shell paint first and keeps the switch
  // interactive. Subsequent zone/filter changes render normally (already mounted).
  const [matrixMounted, setMatrixMounted] = useState(false);
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => startTransition(() => setMatrixMounted(true)));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Per-region health + coverage stats, derived from the availability data.
  const { healthById, statsById } = useMemo(() => {
    const health = new Map<string, RegionHealth>();
    const stats = new Map<string, RegionStats>();
    for (const location of locations) {
      let available = 0;
      let planned = 0;
      let interim = 0;
      for (const service of services) {
        const status = service.availability[location.id]?.status;
        if (status === "available") available += 1;
        else if (status === "planned") planned += 1;
        else if (status === "interim") interim += 1;
      }
      stats.set(location.id, { available, planned, interim, total: services.length });
      health.set(location.id, deriveHealth(location.id, available, planned));
    }
    return { healthById: health, statsById: stats };
  }, [locations, services]);

  // Full matrix (no location filtering) — the selected region only highlights a
  // column, so `activeLocationId` is null here and passed to MatrixView instead.
  const rowModel = useMemo(() => {
    const model = buildAvailabilityRowModel({
      locations,
      services,
      query: "",
      statusFilter: state.statusFilter,
      domainFilter: state.domainFilter,
      activeLocationId: null,
      // The row model's only use of `selectedServiceId` is `selectedRow`, which
      // this route never reads — selection is passed straight to MatrixView. Keep
      // it out so toggling a service doesn't rebuild rows/groups (and remount the
      // whole matrix). The dependency is omitted below for the same reason.
      selectedServiceId: null,
    });
    if (state.serviceFilter === "all") return model;
    // Narrow to the single picked service; domain options stay zone-wide.
    return {
      ...model,
      rows: model.rows.filter((row) => row.id === state.serviceFilter),
      groups: model.groups
        .map((group) => ({
          ...group,
          rowIds: group.rowIds.filter((id) => id === state.serviceFilter),
        }))
        .filter((group) => group.rowIds.length > 0),
    };
  }, [locations, services, state.statusFilter, state.domainFilter, state.serviceFilter]);

  const selectLocation = (id: string | null) => dispatch({ type: "selectLocation", value: id });
  // Map / list / matrix-header clicks toggle: clicking the active region clears it.
  // Toggling lives in the reducer so the React Compiler keeps this handler
  // referentially stable — the matrix columns depend on it and must not rebuild
  // when a region is picked.
  const toggleLocation = (id: string) => dispatch({ type: "toggleLocation", id });

  return (
    <PageBody width="wide" gap="compact" className="py-9">
      <PageHeader
        eyebrow="Availability"
        title="Regions"
        description="See where services run and check per-region operational status across your landing zones."
        actions={
          <ZoneSwitcher
            active={state.zone}
            onChange={(value) => dispatch({ type: "setZone", value })}
          />
        }
      />

      <Controls
        statusFilter={state.statusFilter}
        onStatusChange={(value) => dispatch({ type: "setStatus", value })}
        domainFilter={state.domainFilter}
        onDomainChange={(value) => dispatch({ type: "setDomain", value })}
        domainOptions={rowModel.domainOptions}
        serviceFilter={state.serviceFilter}
        onServiceChange={(value) => dispatch({ type: "setService", value })}
        serviceOptions={services}
        view={state.view}
        onViewChange={(value) => dispatch({ type: "setView", value })}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          {state.view === "map" ? (
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <RegionGroups
                locations={locations}
                selectedId={state.selectedLocationId}
                onSelect={toggleLocation}
                healthById={healthById}
              />
              <RegionMap
                className="rounded-none border-0"
                locations={locations}
                selectedId={state.selectedLocationId}
                onSelect={toggleLocation}
                healthById={healthById}
                zoneName={zone.name}
              />
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 className="text-lg font-bold tracking-[-0.02em] text-foreground">
                Service availability
              </h2>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <LegendItem dotClass="bg-success" label="Available" />
                <LegendItem dotClass="bg-warning" label="Limited" />
                <LegendItem dotClass="bg-muted-foreground/30" label="Not available" />
              </div>
            </div>
            {matrixMounted ? (
              <MatrixView
                provider={state.zone}
                locations={locations}
                rows={rowModel.rows}
                groups={rowModel.groups}
                selectedServiceId={state.selectedServiceId}
                onSelect={(id) => dispatch({ type: "toggleService", id })}
                activeLocationId={state.selectedLocationId}
                onLocationSelect={toggleLocation}
              />
            ) : (
              <MatrixSkeleton />
            )}
          </section>
        </div>

        <StickyAside>
          {selected ? (
            <RegionDetail
              region={selected}
              health={healthById.get(selected.id) ?? "operational"}
              stats={
                statsById.get(selected.id) ?? {
                  available: 0,
                  planned: 0,
                  interim: 0,
                  total: services.length,
                }
              }
              maintenance={MAINTENANCE[selected.id] ?? null}
              onViewAll={() => selectLocation(null)}
            />
          ) : (
            <RegionDetailEmpty />
          )}
        </StickyAside>
      </div>
    </PageBody>
  );
}

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
      className="inline-flex w-fit rounded-lg border border-border bg-muted p-0.5"
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
            onPointerEnter={zoneId === "azure" ? preloadAzureServiceIcons : preloadAwsServiceIcons}
            onClick={() => onChange(zoneId)}
            className={cn(
              "flex items-baseline gap-1.5 rounded-md px-3 py-1.5 transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive ? "bg-background shadow-sm" : "hover:bg-background/50",
            )}
          >
            <span
              className={cn(
                "text-[13px] font-bold tracking-[-0.01em]",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {meta.label}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/70">{meta.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

function Controls({
  statusFilter,
  onStatusChange,
  domainFilter,
  onDomainChange,
  domainOptions,
  serviceFilter,
  onServiceChange,
  serviceOptions,
  view,
  onViewChange,
}: {
  statusFilter: LocationStatus | "all";
  onStatusChange: (value: LocationStatus | "all") => void;
  domainFilter: string;
  onDomainChange: (value: string) => void;
  domainOptions: ReadonlyArray<string>;
  serviceFilter: string;
  onServiceChange: (value: string) => void;
  serviceOptions: ReadonlyArray<{ id: string; name: string }>;
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-4">
      <Field label="Status" className="flex-1">
        <Select
          value={statusFilter}
          onValueChange={(value) => onStatusChange(value as LocationStatus | "all")}
        >
          <SelectTrigger aria-label="Status" className="w-full min-w-[140px] text-xs">
            <SelectValue>
              {(value: LocationStatus | "all") =>
                STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Domain" className="flex-1">
        <Select value={domainFilter} onValueChange={(value) => value && onDomainChange(value)}>
          <SelectTrigger aria-label="Domain" className="w-full min-w-[140px] text-xs">
            <SelectValue>
              {(value: string) => (value === "all" ? "All domains" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {domainOptions.map((domain) => (
              <SelectItem key={domain} value={domain}>
                {domain === "all" ? "All domains" : domain}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Service" className="flex-1">
        <Select value={serviceFilter} onValueChange={(value) => value && onServiceChange(value)}>
          <SelectTrigger aria-label="Service" className="w-full min-w-[150px] text-xs">
            <SelectValue>
              {(value: string) =>
                value === "all"
                  ? "All services"
                  : (serviceOptions.find((service) => service.id === value)?.name ?? value)
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectItem value="all">All services</SelectItem>
            {serviceOptions.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {service.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="ml-auto">
        <Field label="View">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => {
              if (value === "map" || value === "matrix") onViewChange(value);
            }}
            size="sm"
            spacing={1}
            aria-label="View mode"
            className="gap-0.5 rounded-lg bg-muted p-0.5"
          >
            <ToggleGroupItem
              value="map"
              className="rounded-md border-0 bg-transparent text-xs font-semibold aria-pressed:bg-background aria-pressed:shadow-sm"
            >
              <IconMap className="size-3.5" data-icon="inline-start" />
              Map
            </ToggleGroupItem>
            <ToggleGroupItem
              value="matrix"
              className="rounded-md border-0 bg-transparent text-xs font-semibold aria-pressed:bg-background aria-pressed:shadow-sm"
            >
              <IconTable className="size-3.5" data-icon="inline-start" />
              Matrix
            </ToggleGroupItem>
          </ToggleGroup>
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/**
 * Sticky wrapper for the detail sidebar. When the content fits the viewport it
 * pins below the top bar; when it is taller, the sticky top goes negative so
 * the sidebar scrolls along with the page and pins once its bottom is in view
 * (no inner scrollbar).
 */
function StickyAside({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(76);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    // Batch the layout read + state write into one rAF so a burst of resize /
    // ResizeObserver callbacks coalesces to a single measurement per frame
    // (avoids read→write→reflow thrash and RO feedback loops).
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setTop(Math.min(76, window.innerHeight - el.offsetHeight - 16));
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div ref={ref} className="xl:sticky" style={{ top }}>
      {children}
    </div>
  );
}

const GROUP_BANDS: ReadonlyArray<{ label: string; min: number; max: number }> = [
  { label: "North America", min: -180, max: -30 },
  { label: "Europe", min: -30, max: 60 },
  { label: "Asia Pacific", min: 60, max: 200 },
];

const CARD_PIN: Record<RegionHealth, string> = {
  operational: "text-success",
  maintenance: "text-warning",
  degraded: "text-critical",
  expanding: "text-brand",
};

/** Grouped region selector cards — the band at the top of the map frame. */
function RegionGroups({
  locations,
  selectedId,
  onSelect,
  healthById,
}: {
  locations: ReadonlyArray<Location>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  healthById: ReadonlyMap<string, RegionHealth>;
}) {
  const groups = GROUP_BANDS.map((band) => ({
    ...band,
    regions: locations.filter(
      (l) => l.coordinates && l.coordinates[0] >= band.min && l.coordinates[0] < band.max,
    ),
  })).filter((g) => g.regions.length > 0);

  // Column widths follow each band's longitude span so the group headers sit
  // roughly above their territory on the equirectangular map below.
  const bandTemplate = groups
    .map((g) => `${Math.min(g.max, 180) - Math.max(g.min, -180)}fr`)
    .join(" ");

  return (
    <div
      className="grid border-b border-border max-lg:divide-y max-lg:divide-border lg:[grid-template-columns:var(--bands)] lg:divide-x lg:divide-border"
      style={{ "--bands": bandTemplate } as React.CSSProperties}
    >
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-2.5 px-3 py-3">
          <h3 className="text-center text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {group.label}
          </h3>
          {/* auto-fill keeps lone cards at track width instead of full-bleed. */}
          <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(132px,1fr))]">
            {group.regions.map((region) => (
              <RegionCard
                key={region.id}
                region={region}
                health={healthById.get(region.id) ?? "operational"}
                selected={region.id === selectedId}
                onSelect={() => onSelect(region.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RegionCard({
  region,
  health,
  selected,
  onSelect,
}: {
  region: Location;
  health: RegionHealth;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-brand-tint/40"
          : "border-border bg-card hover:border-border-strong",
      )}
    >
      <IconMapPin
        className={cn("mt-px size-4 shrink-0", selected ? "text-primary" : CARD_PIN[health])}
        fill="currentColor"
        stroke="var(--color-card)"
        strokeWidth={1.5}
        aria-hidden
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold leading-tight text-foreground">
          {regionLabel(region)}
        </span>
        <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
          {region.id}
        </span>
      </span>
    </button>
  );
}

function LegendItem({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 rounded-full", dotClass)} />
      {label}
    </span>
  );
}

/** Reserves the matrix's above-the-fold height while its mount is deferred. */
function MatrixSkeleton() {
  return (
    <Skeleton
      aria-busy
      aria-label="Loading service availability"
      className="min-h-[480px] rounded-lg"
    />
  );
}

/**
 * Full-body fallback while the availability projection (a live Confluence fetch
 * + parse in the real adapter) resolves. The static page header paints instantly;
 * the controls bar, map, matrix and region aside hold their real layout so the
 * page doesn't jump when data lands. Distinct from MatrixSkeleton, which only
 * covers the post-data matrix mount.
 */
function AvailabilitySkeleton() {
  return (
    <PageBody width="wide" gap="compact" className="py-9">
      <PageHeader
        eyebrow="Availability"
        title="Regions"
        description="See where services run and check per-region operational status across your landing zones."
        actions={<Skeleton className="h-9 w-[132px] rounded-lg" />}
      />
      <div aria-busy aria-label="Loading availability" className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full max-w-lg rounded-lg" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <Skeleton className="h-[260px] w-full rounded-xl" />
            <Skeleton className="min-h-[480px] w-full rounded-lg" />
          </div>
          <Skeleton className="min-h-[320px] w-full rounded-xl" />
        </div>
      </div>
    </PageBody>
  );
}

function RegionDetailEmpty({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card p-8 text-center",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground"
      >
        <IconMapPin className="size-5" stroke={1.75} />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-[13px] font-bold text-foreground">No region selected</p>
        <p className="max-w-[28ch] text-xs leading-[1.5] text-muted-foreground">
          Pick a region on the map or in the matrix to see its details, service coverage, and
          status.
        </p>
      </div>
    </aside>
  );
}

/** Pin colour rule: maintenance windows win; empty regions are expanding. */
function deriveHealth(id: string, available: number, planned: number): RegionHealth {
  if (MAINTENANCE[id]) return "maintenance";
  if (available === 0) return "expanding";
  if (planned > available) return "expanding";
  return "operational";
}
