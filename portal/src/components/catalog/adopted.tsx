/**
 * Catalog direction "Adopted mainline".
 *
 * The review-liked mainline `/catalog` design carried into the portal:
 * compact tool header + search, type tabs, facet rail (domain / status /
 * region), and the Cards ↔ Table toggle. Reuses the mainline's exported
 * building blocks read-only (CatalogSearchField, ViewModeToggle, StatusChip,
 * ServiceIcon, Popover, Badge); the file-local layout pieces are mirrored
 * here because the mainline route keeps them private — the mainline file is
 * not modified.
 *
 * Services, landing zones, and guardrail areas all link to their detail
 * routes (`/catalog/$topicId`, `/guardrails/$guardrailId`). Sources are their
 * own surface at `/sources`, so the catalog carries no Sources tab.
 */
import { useMemo, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  IconArrowRight,
  IconArrowUpRight,
  IconChevronDown,
  IconLayoutGrid,
  IconTable,
} from "@tabler/icons-react";
import type { Topic } from "@atlas/schema";

import type {
  AvailabilityRecord,
  LandingZoneData,
  Location,
  LocationStatus,
} from "@/api/server/availability";
import { CatalogSearchField } from "@/components/catalog-search-field";
import { ServiceIcon } from "@/components/explore/service-icon";
import { ServiceIconFallback } from "@/components/explore/service-icon-frame";
import { StatusChip } from "@/components/explore/status-chip";
import { ViewModeToggle } from "@/components/explore/view-mode-toggle";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { findAvailabilityServiceForTopic } from "@/lib/availability-service";
import { cn } from "@/lib/utils";

type ViewMode = "cards" | "table";
type AdoptedTab = "services" | "landing-zones" | "guardrails";

export function CatalogAdopted({
  topics,
  zone,
}: {
  topics: ReadonlyArray<Topic>;
  zone: LandingZoneData;
}) {
  const [tab, setTab] = useState<AdoptedTab>("services");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("cards");

  const serviceTopics = topics.filter((topic) => topic.topic_type === "service");
  const landingZones = topics.filter((topic) => topic.topic_type === "landing-zone");
  const guardrails = topics.filter((topic) => topic.topic_type === "guardrail-area");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-2">
          <h1 className="w-fit bg-background text-2xl font-bold tracking-[-0.02em] text-foreground">
            Catalog
          </h1>
          <p className="w-fit max-w-[60ch] bg-background text-[13.5px] leading-[1.55] text-muted-foreground">
            Approved services, landing zones, and guardrail areas, with where they run and the
            authoritative sources behind them.
          </p>
        </header>
        <CatalogSearchField
          value={query}
          onChange={setQuery}
          placeholder="Filter services, zones, guardrails…"
          className="h-10 w-full rounded-md shadow-none sm:max-w-[420px]"
        />
      </div>

      <div className="flex items-center justify-between gap-4 border-b border-border">
        <div role="tablist" aria-label="Catalog type" className="flex gap-0.5">
          <TypeTab
            label="Services"
            count={serviceTopics.length}
            active={tab === "services"}
            onSelect={() => setTab("services")}
          />
          <TypeTab
            label="Landing zones"
            count={landingZones.length}
            active={tab === "landing-zones"}
            onSelect={() => setTab("landing-zones")}
          />
          <TypeTab
            label="Guardrails"
            count={guardrails.length}
            active={tab === "guardrails"}
            onSelect={() => setTab("guardrails")}
          />
        </div>
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
      </div>

      <div key={tab}>
        {tab === "services" ? (
          <TopicWorkspace
            type="service"
            topics={serviceTopics}
            zone={zone}
            query={query}
            view={view}
          />
        ) : null}
        {tab === "landing-zones" ? (
          <TopicWorkspace
            type="landing-zone"
            topics={landingZones}
            zone={zone}
            query={query}
            view={view}
          />
        ) : null}
        {tab === "guardrails" ? (
          <TopicWorkspace
            type="guardrail-area"
            topics={guardrails}
            zone={zone}
            query={query}
            view={view}
          />
        ) : null}
      </div>
    </div>
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
/*  Topic workspace: facet rail + cards/table                                 */
/* -------------------------------------------------------------------------- */

const TYPE_NOUN: Record<Topic["topic_type"], string> = {
  service: "services",
  "landing-zone": "landing zones",
  "guardrail-area": "guardrail areas",
};

const TYPE_COLUMN: Record<Topic["topic_type"], string> = {
  service: "Service",
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
  const isService = type === "service";
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
      if (isService) {
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
  }, [topics, query, domains, status, region, isService, serviceFor, zone.locations]);

  const domainOptions = useMemo(() => buildDomainOptions(topics), [topics]);
  const statusOptions = useMemo<ReadonlyArray<StatusOption>>(
    () =>
      isService
        ? [
            { value: "available", label: "Available" },
            { value: "planned", label: "Planned" },
          ]
        : buildTopicStatusOptions(topics),
    [isService, topics],
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
        regions={isService ? zone.locations : null}
        region={region}
        onRegionChange={setRegion}
        dirty={dirty}
        onReset={reset}
      />

      <div className="min-w-0">
        {filtered.length === 0 ? (
          <EmptyState label={TYPE_NOUN[type]} />
        ) : (
          <div key={view}>
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
          name="proto-facet-status"
          label="Any status"
          checked={status === "all"}
          onChange={() => onStatusChange("all")}
        />
        {statusOptions.map((option) => (
          <FacetRadio
            key={option.value}
            name="proto-facet-status"
            label={option.label}
            checked={status === option.value}
            onChange={() => onStatusChange(option.value)}
          />
        ))}
      </FacetGroup>

      {regions ? (
        <FacetGroup label="Region">
          <FacetRadio
            name="proto-facet-region"
            label="All regions"
            checked={region === "all"}
            onChange={() => onRegionChange("all")}
          />
          {regions.map((location) => (
            <FacetRadio
              key={location.id}
              name="proto-facet-region"
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
      <p className="w-fit bg-background font-mono type-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground">
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
  if (type === "service") {
    const grouped = groupByCategory(topics);
    return (
      <div className="flex flex-col gap-8">
        {grouped.map(([category, items]) => (
          <section key={category} className="flex flex-col gap-3">
            <CategoryHeader category={category} count={items.length} />
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((topic) => (
                <ServiceCard
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
    <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((topic) => (
        <li key={topic.id}>
          <TopicCard topic={topic} />
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/*  Table view                                                                */
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
  const open = (topicId: string) => {
    if (type === "guardrail-area") {
      void navigate({ to: "/guardrails/$guardrailId", params: { guardrailId: topicId } });
    } else {
      void navigate({ to: "/catalog/$topicId", params: { topicId } });
    }
  };

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
                    <TopicNameLink topic={topic} type={type} />
                    <span className="truncate font-mono type-caption text-muted-foreground">
                      {topic.id}
                    </span>
                  </span>
                </div>
              </Td>
              <Td className="text-muted-foreground">{topic.category}</Td>
              <Td>
                {type === "service" ? (
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

function TopicNameLink({ topic, type }: { topic: Topic; type: Topic["topic_type"] }) {
  const className =
    "truncate font-semibold text-foreground focus-visible:underline focus-visible:outline-none";
  const stop = (event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation();
  if (type === "guardrail-area") {
    return (
      <Link
        to="/guardrails/$guardrailId"
        params={{ guardrailId: topic.id }}
        onClick={stop}
        className={className}
      >
        {topic.name}
      </Link>
    );
  }
  return (
    <Link
      to="/catalog/$topicId"
      params={{ topicId: topic.id }}
      onClick={stop}
      className={className}
    >
      {topic.name}
    </Link>
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

function TableServiceIcon({
  topic,
  service,
}: {
  topic: Topic;
  service: AvailabilityRecord | null;
}) {
  return service ? (
    <ServiceIcon serviceId={service.id} size="sm" />
  ) : (
    <ServiceIconFallback serviceId={topic.id} size="sm" />
  );
}

/* -------------------------------------------------------------------------- */
/*  Status cell -> per-region availability popover                            */
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
        <ServiceStatusChip status={status} regionCount={active.length} />
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
            const sub = cellStatus === "planned" && cell?.note ? `ETA ${cell.note}` : location.sub;
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

function ServiceStatusChip({
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
      <h2 className="w-fit bg-background font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {category}
      </h2>
      <span className="rounded-full border border-border bg-secondary px-1.5 py-px font-mono text-[11px] font-semibold text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

/* Surface card with faint brand corner ticks (Blueprint service card). */
const CARD_BASE = cn(
  "group relative flex h-full flex-col gap-2.5 rounded-sm border border-border bg-card p-4 transition-[border-color,box-shadow]",
  "hover:border-border-strong hover:shadow-sm",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  "before:pointer-events-none before:absolute before:left-[-1px] before:top-[-1px] before:size-[7px] before:border-l before:border-t before:border-primary/50 before:content-['']",
  "after:pointer-events-none after:absolute after:bottom-[-1px] after:right-[-1px] after:size-[7px] after:border-b after:border-r after:border-primary/50 after:content-['']",
);

function CardHead({ icon, title, slug }: { icon: React.ReactNode; title: string; slug: string }) {
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

function ServiceCard({
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

  const body = (
    <>
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
    </>
  );

  return (
    <Link to="/catalog/$topicId" params={{ topicId: topic.id }} className={CARD_BASE}>
      {body}
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
        <span aria-hidden className="size-1.5 rounded-full ring-1 ring-inset ring-border-strong" />+
        {overflow}
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
    status === "available"
      ? "bg-success"
      : status === "planned"
        ? "bg-info"
        : "bg-muted-foreground";
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

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-6 type-detail text-muted-foreground">
      <p className="font-bold text-foreground">No matching {label}.</p>
      <p className="mt-1 leading-6">The registry is empty or your filter excluded every entry.</p>
    </div>
  );
}
