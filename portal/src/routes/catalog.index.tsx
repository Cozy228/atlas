import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";
import type { Source, Topic } from "@atlas/schema";

import {
  availabilityQueryOptions,
  sourceDiscoveryQueryOptions,
  topicDiscoveryQueryOptions,
} from "@/api/queries";
import type { LandingZoneData } from "@/api/server/availability";
import { CatalogSearchField } from "@/components/catalog-search-field";
import {
  AuthorityBadge,
  FreshnessIndicator,
  SourceClassBadge,
  VisibilityBadge,
} from "@/components/evidence/badges";
import { ServiceIcon } from "@/components/explore/service-icon";
import { ServiceIconFallback } from "@/components/explore/service-icon-frame";
import { StatusChip } from "@/components/explore/status-chip";
import { PageBody, PageHeader } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

  const capabilities = topics.filter((topic) => topic.topic_type === "capability");
  const landingZones = topics.filter((topic) => topic.topic_type === "landing-zone");
  const guardrails = topics.filter((topic) => topic.topic_type === "guardrail-area");

  return (
    <PageBody width="comfortable" gap="compact">
      <PageHeader
        eyebrow="Discovery"
        title="Catalog"
        description="Approved platform capabilities, landing zones, guardrail areas, and the authoritative sources behind them — one surface, filtered by type."
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          navigate({ search: { tab: value as CatalogTab }, replace: true })
        }
      >
        <TabsList className="h-9">
          <TabTrigger value="capabilities" label="Capabilities" count={capabilities.length} />
          <TabTrigger value="landing-zones" label="Landing zones" count={landingZones.length} />
          <TabTrigger value="guardrails" label="Guardrails" count={guardrails.length} />
          <TabTrigger value="sources" label="Sources" count={sources.length} />
        </TabsList>

        <TabsContent value="capabilities" className="pt-4">
          <CapabilitiesPanel topics={capabilities} zone={defaultZone} />
        </TabsContent>
        <TabsContent value="landing-zones" className="pt-4">
          <ZonesPanel topics={landingZones} />
        </TabsContent>
        <TabsContent value="guardrails" className="pt-4">
          <GuardrailsPanel topics={guardrails} />
        </TabsContent>
        <TabsContent value="sources" className="pt-4">
          <SourcesPanel sources={sources} />
        </TabsContent>
      </Tabs>
    </PageBody>
  );
}

function TabTrigger({ value, label, count }: { value: CatalogTab; label: string; count: number }) {
  return (
    <TabsTrigger value={value}>
      {label}
      <span className="font-mono type-caption font-semibold text-muted-foreground">{count}</span>
    </TabsTrigger>
  );
}

function useTextFilter<T>(items: ReadonlyArray<T>, fields: (item: T) => string[]) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => fields(item).some((value) => value.toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, query]);
  return { query, setQuery, filtered };
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
    <div className="flex items-center gap-2">
      <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {category}
      </h2>
      <span className="rounded-full bg-border px-1.5 py-px font-mono text-xs font-bold text-muted-foreground">
        {count}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function CapabilitiesPanel({
  topics,
  zone,
}: {
  topics: ReadonlyArray<Topic>;
  zone: LandingZoneData;
}) {
  const { query, setQuery, filtered } = useTextFilter(topics, (topic) => [
    topic.name,
    topic.description,
    topic.category,
  ]);
  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <div className="flex flex-col gap-6">
      <CatalogSearchField
        value={query}
        onChange={setQuery}
        placeholder="Filter services… name, description, domain"
      />
      {grouped.length === 0 ? (
        <EmptyState label="services" />
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([category, items]) => (
            <section key={category} className="flex flex-col gap-3">
              <CategoryHeader category={category} count={items.length} />
              <div
                className="grid gap-2.5"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
              >
                {items.map((topic) => (
                  <CapabilityCard key={topic.id} topic={topic} zone={zone} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ZonesPanel({ topics }: { topics: ReadonlyArray<Topic> }) {
  const { query, setQuery, filtered } = useTextFilter(topics, (topic) => [
    topic.name,
    topic.description,
    topic.category,
  ]);
  const zones = filtered.toSorted((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-col gap-6">
      <CatalogSearchField
        value={query}
        onChange={setQuery}
        placeholder="Filter landing zones… name, description, domain"
      />
      {zones.length === 0 ? (
        <EmptyState label="landing zones" />
      ) : (
        <ul
          className="grid gap-2.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
        >
          {zones.map((zone) => (
            <li key={zone.id}>
              <TopicCard topic={zone} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GuardrailsPanel({ topics }: { topics: ReadonlyArray<Topic> }) {
  const { query, setQuery, filtered } = useTextFilter(topics, (topic) => [
    topic.name,
    topic.description,
    topic.category,
  ]);
  const grouped = useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <div className="flex flex-col gap-6">
      <CatalogSearchField
        value={query}
        onChange={setQuery}
        placeholder="Filter guardrail areas… name, description, domain"
      />
      {grouped.length === 0 ? (
        <EmptyState label="guardrail areas" />
      ) : (
        <div className="flex flex-col gap-8">
          {grouped.map(([category, items]) => (
            <section key={category} className="flex flex-col gap-3">
              <CategoryHeader category={category} count={items.length} />
              <ul
                className="grid gap-2.5"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
              >
                {items.map((topic) => (
                  <li key={topic.id}>
                    <TopicCard topic={topic} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function SourcesPanel({ sources }: { sources: ReadonlyArray<Source> }) {
  const { query, setQuery, filtered } = useTextFilter(sources, (source) => [
    source.title,
    source.steward,
    source.id,
    source.authority_scope.join(" "),
  ]);
  const sorted = useMemo(
    () => filtered.toSorted((a, b) => compareByAuthority(a, b) || a.title.localeCompare(b.title)),
    [filtered],
  );

  return (
    <div className="flex flex-col gap-6">
      <CatalogSearchField
        value={query}
        onChange={setQuery}
        placeholder="Filter sources… title, steward, id, scope"
      />
      {sorted.length === 0 ? (
        <EmptyState label="sources" />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-card">
          {sorted.map((source, index) => (
            <li key={source.id} className={cn(index > 0 && "border-t border-border")}>
              <SourceRow source={source} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CapabilityCard({ topic, zone }: { topic: Topic; zone: LandingZoneData }) {
  const service = findAvailabilityServiceForTopic(topic, zone.services);
  const activeLocations = service
    ? zone.locations.filter(
        (location) =>
          service.availability[location.id] &&
          service.availability[location.id]?.status !== "not-planned",
      )
    : [];
  const visibleChips = activeLocations.slice(0, 2);
  const overflow = activeLocations.length - visibleChips.length;

  return (
    <Link
      to="/catalog/$topicId"
      params={{ topicId: topic.id }}
      className={cn(
        "group flex flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow]",
        "hover:border-border-strong hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          {service ? (
            <ServiceIcon serviceId={service.id} size="xl" />
          ) : (
            <ServiceIconFallback serviceId={topic.id} size="xl" />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <p className="type-body font-bold tracking-[-0.01em] text-foreground">{topic.name}</p>
            <p className="line-clamp-2 min-h-[2.5rem] type-detail leading-5 text-muted-foreground">
              {topic.description}
            </p>
          </div>
        </div>
        <IconArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleChips.map((location) => {
          const cell = service!.availability[location.id]!;
          return (
            <StatusChip
              key={location.id}
              status={cell.status}
              text={
                cell.status === "planned" && cell.note
                  ? `${location.label} ${cell.note}`
                  : location.label
              }
            />
          );
        })}
        {overflow > 0 ? (
          <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono type-status-chip font-semibold text-muted-foreground">
            +{overflow}
          </span>
        ) : null}
        {activeLocations.length === 0 ? (
          <span className="font-mono type-status-chip text-muted-foreground">
            no availability projection
          </span>
        ) : null}
      </div>
      <CardFooter topic={topic} />
    </Link>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  return (
    <Link
      to="/catalog/$topicId"
      params={{ topicId: topic.id }}
      className={cn(
        "group flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-5 transition-[border-color,box-shadow]",
        "hover:border-border-strong hover:shadow-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="inline-flex items-center gap-1 type-body font-bold tracking-[-0.01em] text-foreground">
          {topic.name}
          <IconArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
        </p>
      </div>
      <p className="line-clamp-2 min-h-[2.5rem] type-detail leading-5 text-muted-foreground">
        {topic.description}
      </p>
      <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-border pt-3 text-xs">
        <DefRow label="Domain" value={topic.category} />
        <DefRow label="Status" value={topic.status} mono />
        <DefRow label="Owner" value={topic.owner_team} />
        <DefRow label="Support" value={topic.support_channel} mono />
      </dl>
    </Link>
  );
}

function CardFooter({ topic }: { topic: Topic }) {
  return (
    <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
      <span className="truncate font-semibold text-foreground">{topic.owner_team}</span>
      <span className="font-mono">{topic.support_channel}</span>
    </div>
  );
}

function DefRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="font-mono text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("truncate text-xs text-foreground", mono && "font-mono")}>{value}</dd>
    </>
  );
}

function SourceRow({ source }: { source: Source }) {
  return (
    <Link
      to="/sources/$sourceId"
      params={{ sourceId: source.id }}
      className={cn(
        "group grid grid-cols-1 gap-3 px-4 py-3 transition-colors lg:grid-cols-[minmax(0,2.4fr)_minmax(0,1.4fr)_auto]",
        "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <div className="flex flex-col gap-1">
        <p className="flex items-center gap-2 type-detail font-bold tracking-[-0.01em] text-foreground">
          {source.title}
          <span className="font-mono type-caption font-medium text-muted-foreground">
            {source.id}
          </span>
        </p>
        <p className="text-xs leading-5 text-muted-foreground">
          steward {source.steward} · scope {source.authority_scope.join(", ")}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <AuthorityBadge level={source.authority_level} />
        <VisibilityBadge value={source.visibility} />
        <FreshnessIndicator source={source} />
        <SourceClassBadge value={source.source_class} />
      </div>
      <span className="flex items-center justify-end gap-1 self-end font-mono text-xs text-primary lg:self-center">
        Inspect
        <IconArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
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
