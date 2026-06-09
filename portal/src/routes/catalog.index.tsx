import { useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconChevronDown,
  IconLayoutGrid,
  IconTable,
} from "@tabler/icons-react";
import type { Source, Topic } from "@atlas/schema";

import {
  availabilityQueryOptions,
  sourceDiscoveryQueryOptions,
  topicDiscoveryQueryOptions,
} from "@/api/queries";
import type {
  AvailabilityRecord,
  LandingZoneData,
  Location,
  LocationStatus,
} from "@/api/server/availability";
import { CatalogSearchField } from "@/components/catalog-search-field";
import { AuthorityBadge, FreshnessIndicator } from "@/components/evidence/badges";
import { ServiceIcon } from "@/components/explore/service-icon";
import { ServiceIconFallback } from "@/components/explore/service-icon-frame";
import { StatusChip } from "@/components/explore/status-chip";
import { ViewModeToggle } from "@/components/explore/view-mode-toggle";
import { PageBody, PageHeader } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { findAvailabilityServiceForTopic } from "@/lib/capability-service";
import { compareByAuthority } from "@/lib/evidence";
import { cn } from "@/lib/utils";

type LoaderData = {
  topics: ReadonlyArray<Topic>;
  sources: ReadonlyArray<Source>;
  defaultZone: LandingZoneData;
};

const TABS = ["capabilities", "landing-zones", "guardrails", "sources"] as const;
type CatalogTab = (typeof TABS)[number];

function isCatalogTab(value: unknown): value is CatalogTab {
  return typeof value === "string" && (TABS as ReadonlyArray<string>).includes(value);
}

export const Route = createFileRoute("/catalog/")({
  validateSearch: (search: Record<string, unknown>): { tab?: CatalogTab } => ({
    tab: isCatalogTab(search.tab) ? search.tab : undefined,
  }),
  loader: async ({ context }): Promise<LoaderData> => {
    const [topicsResp, sourcesResp, availability] = await Promise.all([
      context.queryClient.ensureQueryData(topicDiscoveryQueryOptions),
      context.queryClient.ensureQueryData(sourceDiscoveryQueryOptions),
      context.queryClient.ensureQueryData(availabilityQueryOptions),
    ]);
    return {
      topics: topicsResp.topics,
      sources: sourcesResp.sources,
      defaultZone: availability.zones[0]!,
    };
  },
  component: CatalogRoute,
});

function CatalogRoute() {
  const { topics, sources, defaultZone } = Route.useLoaderData();
  const { tab } = Route.useSearch();
  const activeTab = tab ?? "capabilities";
  const navigate = Route.useNavigate();
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("cards");

  const capabilities = topics.filter((topic) => topic.topic_type === "capability");
  const landingZones = topics.filter((topic) => topic.topic_type === "landing-zone");
  const guardrails = topics.filter((topic) => topic.topic_type === "guardrail-area");

  return (
    <PageBody width="comfortable" gap="compact">
      {/* Compact tool-page header: shared PageHeader + inline filter field below.
          Atlas is an instrument, not a landing page; density beats a hero here. */}
      <div className="flex flex-col gap-4 pt-1">
        <PageHeader
          eyebrow="Reference"
          title="Catalog"
          description="Approved capabilities, landing zones, and guardrail areas, with where they run and the authoritative sources behind them."
        />
        <CatalogSearchField
          value={query}
          onChange={setQuery}
          placeholder="Filter capabilities, zones, sources…"
          className="h-10 w-full rounded-md shadow-none sm:max-w-[420px]"
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-border">
        <div role="tablist" aria-label="Catalog type" className="flex gap-0.5">
          <TypeTab
            label="Capabilities"
            count={capabilities.length}
            active={activeTab === "capabilities"}
            onSelect={() => navigate({ search: { tab: "capabilities" }, replace: true })}
          />
          <TypeTab
            label="Landing zones"
            count={landingZones.length}
            active={activeTab === "landing-zones"}
            onSelect={() => navigate({ search: { tab: "landing-zones" }, replace: true })}
          />
          <TypeTab
            label="Guardrails"
            count={guardrails.length}
            active={activeTab === "guardrails"}
            onSelect={() => navigate({ search: { tab: "guardrails" }, replace: true })}
          />
          <TypeTab
            label="Sources"
            count={sources.length}
            active={activeTab === "sources"}
            onSelect={() => navigate({ search: { tab: "sources" }, replace: true })}
          />
        </div>
        {activeTab !== "sources" ? (
          <div className="hidden shrink-0 pb-1 sm:block">
            <ViewModeToggle
              value={view}
              onChange={setView}
              ariaLabel="Result layout"
              options={[
                {
                  value: "cards",
                  label: "Cards",
                  icon: <IconLayoutGrid className="size-3.5" aria-hidden />,
                },
                {
                  value: "table",
                  label: "Table",
                  icon: <IconTable className="size-3.5" aria-hidden />,
                },
              ]}
            />
          </div>
        ) : null}
      </div>

      {/* Keyed on the active tab so a switch crossfades the panel (~120ms). */}
      <div key={activeTab} className="animate-in fade-in duration-150 motion-reduce:animate-none">
        {activeTab === "capabilities" ? (
          <TopicWorkspace
            type="capability"
            topics={capabilities}
            zone={defaultZone}
            query={query}
            view={view}
          />
        ) : null}
        {activeTab === "landing-zones" ? (
          <TopicWorkspace
            type="landing-zone"
            topics={landingZones}
            zone={defaultZone}
            query={query}
            view={view}
          />
        ) : null}
        {activeTab === "guardrails" ? (
          <TopicWorkspace
            type="guardrail-area"
            topics={guardrails}
            zone={defaultZone}
            query={query}
            view={view}
          />
        ) : null}
        {activeTab === "sources" ? <SourcesPanel sources={sources} query={query} /> : null}
      </div>
    </PageBody>
  );
}

function TypeTab({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 rounded-sm border-b-2 px-3.5 py-2.5 text-sm transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary font-semibold text-primary"
          : "border-transparent font-medium text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "font-mono text-[11px] font-semibold tabular-nums",
          active ? "text-primary" : "text-muted-foreground/80",
        )}
      >
        {count}
      </span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*  Availability helpers (catalog altitude)                                   */
/* -------------------------------------------------------------------------- */

type CapAvailStatus = "available" | "planned" | "none";

/** Locations where this capability is available or planned (not "not-planned"). */
function activeLocations(
  service: AvailabilityRecord | null,
  locations: ReadonlyArray<Location>,
): ReadonlyArray<Location> {
  if (!service) return [];
  return locations.filter((location) => {
    const status = service.availability[location.id]?.status;
    return status != null && status !== "not-planned";
  });
}

/** Catalog-altitude status summary for a capability, derived from availability. */
function capAvailStatus(
  service: AvailabilityRecord | null,
  locations: ReadonlyArray<Location>,
): CapAvailStatus {
  const active = activeLocations(service, locations);
  if (active.length === 0) return "none";
  const anyLive = active.some((loc) => service!.availability[loc.id]?.status === "available");
  return anyLive ? "available" : "planned";
}

/* -------------------------------------------------------------------------- */
/*  Topic workspace: facet rail + content bar + cards/table content           */
/* -------------------------------------------------------------------------- */

type ViewMode = "cards" | "table";

const TYPE_NOUN: Record<Topic["topic_type"], string> = {
  capability: "capabilities",
  "landing-zone": "landing zones",
  "guardrail-area": "guardrail areas",
};

const TYPE_COLUMN: Record<Topic["topic_type"], string> = {
  capability: "Service",
  "landing-zone": "Landing zone",
  "guardrail-area": "Guardrail area",
};

const TOPIC_STATUS_LABEL: Record<Topic["status"], string> = {
  active: "Active",
  planned: "Planned",
  deprecated: "Deprecated",
};

function TopicWorkspace({
  type,
  topics,
  zone,
  query,
  view,
}: {
  type: Topic["topic_type"];
  topics: ReadonlyArray<Topic>;
  zone: LandingZoneData;
  query: string;
  view: ViewMode;
}) {
  const isCapability = type === "capability";
  const [domains, setDomains] = useState<ReadonlySet<string>>(new Set());
  const [status, setStatus] = useState("all");
  const [region, setRegion] = useState("all");

  const serviceFor = useMemo(() => {
    const cache = new Map<string, AvailabilityRecord | null>();
    return (topic: Topic): AvailabilityRecord | null => {
      if (!cache.has(topic.id)) {
        cache.set(topic.id, findAvailabilityServiceForTopic(topic, zone.services));
      }
      return cache.get(topic.id) ?? null;
    };
  }, [zone.services]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics.filter((topic) => {
      if (q) {
        const haystack = [topic.name, topic.description, topic.category, topic.owner_team]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (domains.size && !domains.has(topic.category)) return false;
      if (isCapability) {
        const service = serviceFor(topic);
        if (region !== "all") {
          const cell = service?.availability[region]?.status;
          if (cell == null || cell === "not-planned") return false;
        }
        if (status !== "all" && capAvailStatus(service, zone.locations) !== status) return false;
      } else if (status !== "all" && topic.status !== status) {
        return false;
      }
      return true;
    });
  }, [topics, query, domains, status, region, isCapability, serviceFor, zone.locations]);

  const domainOptions = useMemo(() => buildDomainOptions(topics), [topics]);
  const statusOptions = useMemo<ReadonlyArray<StatusOption>>(
    () =>
      isCapability
        ? [
            { value: "available", label: "Available" },
            { value: "planned", label: "Planned" },
          ]
        : buildTopicStatusOptions(topics),
    [isCapability, topics],
  );

  const dirty = domains.size > 0 || status !== "all" || region !== "all";
  const reset = () => {
    setDomains(new Set());
    setStatus("all");
    setRegion("all");
  };

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-[224px_minmax(0,1fr)]">
      <FacetRail
        domainOptions={domainOptions}
        selectedDomains={domains}
        onToggleDomain={(value) =>
          setDomains((prev) => {
            const next = new Set(prev);
            if (next.has(value)) next.delete(value);
            else next.add(value);
            return next;
          })
        }
        statusOptions={statusOptions}
        status={status}
        onStatusChange={setStatus}
        regions={isCapability ? zone.locations : null}
        region={region}
        onRegionChange={setRegion}
        dirty={dirty}
        onReset={reset}
      />

      <div className="min-w-0">
        {filtered.length === 0 ? (
          <EmptyState label={TYPE_NOUN[type]} />
        ) : (
          <div key={view} className="animate-in fade-in duration-150 motion-reduce:animate-none">
            {view === "cards" ? (
              <CardsView type={type} topics={filtered} zone={zone} serviceFor={serviceFor} />
            ) : (
              <TableView type={type} topics={filtered} zone={zone} serviceFor={serviceFor} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Facet rail                                                                */
/* -------------------------------------------------------------------------- */

type DomainOption = { value: string; count: number };
type StatusOption = { value: string; label: string };

function FacetRail({
  domainOptions,
  selectedDomains,
  onToggleDomain,
  statusOptions,
  status,
  onStatusChange,
  regions,
  region,
  onRegionChange,
  dirty,
  onReset,
}: {
  domainOptions: ReadonlyArray<DomainOption>;
  selectedDomains: ReadonlySet<string>;
  onToggleDomain: (value: string) => void;
  statusOptions: ReadonlyArray<StatusOption>;
  status: string;
  onStatusChange: (value: string) => void;
  regions: ReadonlyArray<Location> | null;
  region: string;
  onRegionChange: (value: string) => void;
  dirty: boolean;
  onReset: () => void;
}) {
  return (
    <aside className="flex flex-row flex-wrap gap-x-7 gap-y-5 lg:sticky lg:top-[72px] lg:flex-col lg:gap-6 lg:self-start">
      <FacetGroup label="Domain">
        {domainOptions.map((option) => {
          const checked = selectedDomains.has(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 py-0.5 text-[13px] transition-colors",
                checked
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleDomain(option.value)}
                className="size-3.5 accent-primary"
              />
              <span className="min-w-0 flex-1 truncate">{option.value}</span>
              <span className="font-mono type-caption text-muted-foreground">{option.count}</span>
            </label>
          );
        })}
      </FacetGroup>

      <FacetGroup label="Status">
        <FacetRadio
          name="facet-status"
          label="Any status"
          checked={status === "all"}
          onChange={() => onStatusChange("all")}
        />
        {statusOptions.map((option) => (
          <FacetRadio
            key={option.value}
            name="facet-status"
            label={option.label}
            checked={status === option.value}
            onChange={() => onStatusChange(option.value)}
          />
        ))}
      </FacetGroup>

      {regions ? (
        <FacetGroup label="Region">
          <FacetRadio
            name="facet-region"
            label="All regions"
            checked={region === "all"}
            onChange={() => onRegionChange("all")}
          />
          {regions.map((location) => (
            <FacetRadio
              key={location.id}
              name="facet-region"
              label={location.label}
              checked={region === location.id}
              onChange={() => onRegionChange(location.id)}
            />
          ))}
        </FacetGroup>
      ) : null}

      {dirty ? (
        <button
          type="button"
          onClick={onReset}
          className="self-start text-xs font-semibold text-primary hover:underline"
        >
          Reset filters
        </button>
      ) : null}
    </aside>
  );
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono type-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function FacetRadio({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2.5 py-0.5 text-[13px] transition-colors",
        checked ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="size-3.5 accent-primary"
      />
      {label}
    </label>
  );
}

/* -------------------------------------------------------------------------- */
/*  Cards view                                                                */
/* -------------------------------------------------------------------------- */

type ServiceLookup = (topic: Topic) => AvailabilityRecord | null;

function CardsView({
  type,
  topics,
  zone,
  serviceFor,
}: {
  type: Topic["topic_type"];
  topics: ReadonlyArray<Topic>;
  zone: LandingZoneData;
  serviceFor: ServiceLookup;
}) {
  if (type === "capability") {
    const grouped = groupByCategory(topics);
    return (
      <div className="flex flex-col gap-8">
        {grouped.map(([category, items]) => (
          <section key={category} className="flex flex-col gap-3">
            <CategoryHeader category={category} count={items.length} />
            <div
              className="grid gap-3.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
            >
              {items.map((topic) => (
                <CapabilityCard
                  key={topic.id}
                  topic={topic}
                  service={serviceFor(topic)}
                  locations={zone.locations}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const sorted = topics.toSorted((a, b) => a.name.localeCompare(b.name));
  return (
    <ul
      className="grid gap-3.5"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
    >
      {sorted.map((topic) => (
        <li key={topic.id}>
          <TopicCard topic={topic} />
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Table view (plain catalog list — NOT a per-region availability matrix)    */
/* -------------------------------------------------------------------------- */

function TableView({
  type,
  topics,
  zone,
  serviceFor,
}: {
  type: Topic["topic_type"];
  topics: ReadonlyArray<Topic>;
  zone: LandingZoneData;
  serviceFor: ServiceLookup;
}) {
  const navigate = useNavigate();
  const isGuardrail = type === "guardrail-area";
  const open = (topicId: string) =>
    isGuardrail
      ? navigate({ to: "/guardrails/$guardrailId", params: { guardrailId: topicId } })
      : navigate({ to: "/catalog/$topicId", params: { topicId } });

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-[13px] [font-variant-numeric:tabular-nums]">
        <thead>
          <tr>
            <Th>{TYPE_COLUMN[type]}</Th>
            <Th>Domain</Th>
            <Th>Status</Th>
            <Th>Owner</Th>
            <Th>Support</Th>
            <Th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {topics.map((topic) => (
            <tr
              key={topic.id}
              onClick={() => open(topic.id)}
              className="group cursor-pointer border-t border-border bg-card transition-colors hover:bg-muted/60"
            >
              <Td>
                <div className="flex items-center gap-2.5">
                  <TableServiceIcon topic={topic} service={serviceFor(topic)} />
                  <span className="flex min-w-0 flex-col">
                    {isGuardrail ? (
                      <Link
                        to="/guardrails/$guardrailId"
                        params={{ guardrailId: topic.id }}
                        onClick={(event) => event.stopPropagation()}
                        className="truncate font-semibold text-foreground focus-visible:underline focus-visible:outline-none"
                      >
                        {topic.name}
                      </Link>
                    ) : (
                      <Link
                        to="/catalog/$topicId"
                        params={{ topicId: topic.id }}
                        onClick={(event) => event.stopPropagation()}
                        className="truncate font-semibold text-foreground focus-visible:underline focus-visible:outline-none"
                      >
                        {topic.name}
                      </Link>
                    )}
                    <span className="truncate font-mono type-caption text-muted-foreground">
                      {topic.id}
                    </span>
                  </span>
                </div>
              </Td>
              <Td className="text-muted-foreground">{topic.category}</Td>
              <Td>
                {type === "capability" ? (
                  <AvailabilityStatusCell
                    topic={topic}
                    service={serviceFor(topic)}
                    locations={zone.locations}
                  />
                ) : (
                  <TopicStatusChip status={topic.status} />
                )}
              </Td>
              <Td className="text-foreground">{topic.owner_team}</Td>
              <Td className="font-mono type-caption text-muted-foreground">
                {topic.support_channel}
              </Td>
              <Td className="text-center text-muted-foreground">
                <IconArrowRight className="inline size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-border bg-muted/50 px-3.5 py-2.5 text-left",
        "font-sans type-status-chip font-semibold uppercase tracking-[0.06em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-3.5 py-2.5 align-middle", className)}>{children}</td>;
}

function TableServiceIcon({ topic, service }: { topic: Topic; service: AvailabilityRecord | null }) {
  return service ? (
    <ServiceIcon serviceId={service.id} size="sm" />
  ) : (
    <ServiceIconFallback serviceId={topic.id} size="sm" />
  );
}

/* -------------------------------------------------------------------------- */
/*  Status cell -> per-region availability popover (escapes table overflow)   */
/* -------------------------------------------------------------------------- */

function AvailabilityStatusCell({
  topic,
  service,
  locations,
}: {
  topic: Topic;
  service: AvailabilityRecord | null;
  locations: ReadonlyArray<Location>;
}) {
  const active = activeLocations(service, locations);
  const status = capAvailStatus(service, locations);

  return (
    <Popover>
      <PopoverTrigger
        className="inline-flex items-center gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={(event: React.MouseEvent) => event.stopPropagation()}
        aria-label={`Availability for ${topic.name}, by region`}
      >
        <CapabilityStatusChip status={status} regionCount={active.length} />
        <IconChevronDown className="size-3 text-muted-foreground" aria-hidden />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 gap-0 p-0"
        onClick={(event: React.MouseEvent) => event.stopPropagation()}
      >
        <PopoverHeader className="px-3 pt-3 pb-2">
          <PopoverTitle className="font-mono type-status-chip font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Availability by region
          </PopoverTitle>
        </PopoverHeader>
        <ul className="flex flex-col">
          {locations.map((location) => {
            const cell = service?.availability[location.id];
            const cellStatus = cell?.status ?? "not-planned";
            const sub =
              cellStatus === "planned" && cell?.note ? `ETA ${cell.note}` : location.sub;
            return (
              <li
                key={location.id}
                className="flex items-center justify-between gap-3 border-t border-border px-3 py-2"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {location.label}
                  </span>
                  <span className="truncate font-mono type-status-chip text-muted-foreground">
                    {sub}
                  </span>
                </span>
                <StatusChip status={cellStatus} />
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end border-t border-border bg-background px-3 py-2">
          <Link
            to="/availability"
            className="inline-flex items-center gap-1 font-mono type-caption font-semibold text-primary hover:underline"
          >
            Open in availability map <IconArrowUpRight className="size-3" aria-hidden />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* -------------------------------------------------------------------------- */
/*  Status chips                                                              */
/* -------------------------------------------------------------------------- */

function CapabilityStatusChip({
  status,
  regionCount,
}: {
  status: CapAvailStatus;
  regionCount: number;
}) {
  if (status === "available") {
    return (
      <Badge variant="success">
        <span aria-hidden className="size-[5px] rounded-full bg-current" />
        GA · {regionCount} {regionCount === 1 ? "region" : "regions"}
      </Badge>
    );
  }
  if (status === "planned") {
    return (
      <Badge variant="info">
        <span aria-hidden className="size-[5px] rounded-full bg-current" />
        Planned
      </Badge>
    );
  }
  return <Badge variant="neutral">No availability yet</Badge>;
}

function TopicStatusChip({ status }: { status: Topic["status"] }) {
  const variant = status === "deprecated" ? "critical" : status === "planned" ? "info" : "success";
  return (
    <Badge variant={variant}>
      <span aria-hidden className="size-[5px] rounded-full bg-current" />
      {TOPIC_STATUS_LABEL[status]}
    </Badge>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sources tab                                                               */
/* -------------------------------------------------------------------------- */

function SourcesPanel({ sources, query }: { sources: ReadonlyArray<Source>; query: string }) {
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? sources.filter((source) =>
          [source.title, source.steward, source.id, source.authority_scope.join(" ")]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : sources;
    return matched.toSorted((a, b) => compareByAuthority(a, b) || a.title.localeCompare(b.title));
  }, [sources, query]);

  if (sorted.length === 0) return <EmptyState label="sources" />;

  return (
    <div className="overflow-hidden rounded-sm border border-border bg-card">
      {sorted.map((source, index) => (
        <SourceEntry
          key={source.id}
          source={source}
          index={index}
          last={index === sorted.length - 1}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared building blocks                                                    */
/* -------------------------------------------------------------------------- */

function buildDomainOptions(topics: ReadonlyArray<Topic>): ReadonlyArray<DomainOption> {
  const counts = new Map<string, number>();
  for (const topic of topics) {
    counts.set(topic.category, (counts.get(topic.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .toSorted((a, b) => a.value.localeCompare(b.value));
}

function buildTopicStatusOptions(topics: ReadonlyArray<Topic>): ReadonlyArray<StatusOption> {
  const present = new Set(topics.map((topic) => topic.status));
  return (["active", "planned", "deprecated"] as const)
    .filter((value) => present.has(value))
    .map((value) => ({ value, label: TOPIC_STATUS_LABEL[value] }));
}

function groupByCategory(topics: ReadonlyArray<Topic>) {
  const map = new Map<string, Topic[]>();
  for (const topic of topics) {
    const list = map.get(topic.category);
    if (list) list.push(topic);
    else map.set(topic.category, [topic]);
  }
  return [...map.entries()]
    .map(([key, items]) => [key, items.toSorted((a, b) => a.name.localeCompare(b.name))] as const)
    .toSorted(([a], [b]) => a.localeCompare(b));
}

function CategoryHeader({ category, count }: { category: string; count: number }) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {category}
      </h2>
      <span className="rounded-full border border-border bg-secondary px-1.5 py-px font-mono text-[11px] font-semibold text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

/* Surface card with faint brand corner ticks (Blueprint capability card). */
const CARD_BASE = cn(
  "group relative flex h-full flex-col gap-2.5 rounded-sm border border-border bg-card p-4 transition-[border-color,box-shadow]",
  "hover:border-border-strong hover:shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "before:pointer-events-none before:absolute before:left-[-1px] before:top-[-1px] before:size-[7px] before:border-l before:border-t before:border-primary/50 before:content-['']",
  "after:pointer-events-none after:absolute after:bottom-[-1px] after:right-[-1px] after:size-[7px] after:border-b after:border-r after:border-primary/50 after:content-['']",
);

function CardHead({
  icon,
  title,
  slug,
}: {
  icon: React.ReactNode;
  title: string;
  slug: string;
}) {
  return (
    <div className="flex items-start gap-3">
      {icon}
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="truncate text-[15px] font-bold leading-tight tracking-[-0.01em] text-foreground">
          {title}
        </p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{slug}</p>
      </div>
      <IconArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </div>
  );
}

function CapabilityCard({
  topic,
  service,
  locations,
}: {
  topic: Topic;
  service: AvailabilityRecord | null;
  locations: ReadonlyArray<Location>;
}) {
  const active = activeLocations(service, locations);
  const visibleChips = active.slice(0, 2);
  const overflow = active.length - visibleChips.length;

  return (
    <Link to="/catalog/$topicId" params={{ topicId: topic.id }} className={CARD_BASE}>
      <CardHead
        icon={
          service ? (
            <ServiceIcon serviceId={service.id} size="xl" />
          ) : (
            <ServiceIconFallback serviceId={topic.id} size="xl" />
          )
        }
        title={topic.name}
        slug={topic.id}
      />
      <p className="line-clamp-2 min-h-[2.5rem] text-[13px] leading-[1.5] text-muted-foreground">
        {topic.description}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleChips.map((location) => {
          const cell = service!.availability[location.id]!;
          return (
            <RegionChip
              key={location.id}
              status={cell.status}
              label={location.label}
              note={cell.note}
            />
          );
        })}
        {overflow > 0 ? <RegionChip overflow={overflow} /> : null}
        {active.length === 0 ? (
          <span className="font-mono text-[11px] text-muted-foreground">
            no availability projection
          </span>
        ) : null}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-2.5 text-[11.5px]">
        <span className="truncate font-semibold text-foreground">{topic.owner_team}</span>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {topic.support_channel}
        </span>
      </div>
    </Link>
  );
}

/* Outlined region chip (hairline border + status dot), per the Blueprint chip spec. */
function RegionChip({
  status,
  label,
  note,
  overflow,
}: {
  status?: LocationStatus;
  label?: string;
  note?: string;
  overflow?: number;
}) {
  if (overflow) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-[2px] border border-border px-2 py-0.5 text-[11.5px] font-semibold text-muted-foreground">
        <span aria-hidden className="size-1.5 rounded-full ring-1 ring-inset ring-border-strong" />
        +{overflow}
      </span>
    );
  }
  const tone =
    status === "available"
      ? "border-success/40 text-success"
      : status === "planned"
        ? "border-info/40 text-info"
        : "border-border text-muted-foreground";
  const dot =
    status === "available" ? "bg-success" : status === "planned" ? "bg-info" : "bg-muted-foreground";
  const text = status === "planned" && note ? `${label} ${note}` : label;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[2px] border px-2 py-0.5 text-[11.5px] font-semibold",
        tone,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />
      {text}
    </span>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  const content = (
    <>
      <CardHead
        icon={<ServiceIconFallback serviceId={topic.id} size="xl" />}
        title={topic.name}
        slug={topic.id}
      />
      <p className="line-clamp-2 min-h-[2.5rem] text-[13px] leading-[1.5] text-muted-foreground">
        {topic.description}
      </p>
      <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 border-t border-border pt-2.5 text-xs">
        <DefRow label="Domain" value={topic.category} />
        <DefRow label="Status" value={topic.status} mono />
        <DefRow label="Owner" value={topic.owner_team} />
        <DefRow label="Support" value={topic.support_channel} mono />
      </dl>
    </>
  );

  // Guardrail areas have a dedicated detail page; other topics use the generic one.
  if (topic.topic_type === "guardrail-area") {
    return (
      <Link to="/guardrails/$guardrailId" params={{ guardrailId: topic.id }} className={CARD_BASE}>
        {content}
      </Link>
    );
  }
  return (
    <Link to="/catalog/$topicId" params={{ topicId: topic.id }} className={CARD_BASE}>
      {content}
    </Link>
  );
}

function DefRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("truncate text-right text-xs text-foreground", mono && "font-mono")}>
        {value}
      </dd>
    </>
  );
}

/* Numbered Document Sources entry (the Blueprint reference-entry pattern). */
function SourceEntry({
  source,
  index,
  last,
}: {
  source: Source;
  index: number;
  last: boolean;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-4 gap-y-3 p-4 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]",
        !last && "border-b border-border",
      )}
    >
      <div className="font-mono text-xl font-semibold leading-none text-primary tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-[15px] font-bold tracking-[-0.01em] text-foreground">{source.title}</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {source.source_class} · {source.id}
        </p>
        <p className="max-w-[66ch] text-[13px] leading-[1.5] text-muted-foreground">
          Steward of {source.authority_scope.join(", ")}.
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <AuthorityBadge level={source.authority_level} />
          <FreshnessIndicator source={source} />
        </div>
      </div>
      <div className="col-start-2 flex flex-col items-start gap-1 text-[12px] text-muted-foreground sm:col-start-3 sm:items-end sm:text-right">
        <span className="whitespace-nowrap">steward {source.steward}</span>
        <Link
          to="/sources/$sourceId"
          params={{ sourceId: source.id }}
          className="inline-flex items-center gap-1 font-mono text-[12px] font-semibold text-primary hover:underline"
        >
          Open source <IconArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-6 type-detail text-muted-foreground">
      <p className="font-bold text-foreground">No matching {label}.</p>
      <p className="mt-1 leading-6">The registry is empty or your filter excluded every entry.</p>
    </div>
  );
}
