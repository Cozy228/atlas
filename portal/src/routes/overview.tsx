import { useMemo, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";
import type { AuthorityLevel, Source, Topic } from "@atlas/schema";

import {
  availabilityQueryOptions,
  sourceDiscoveryQueryOptions,
  topicDiscoveryQueryOptions,
} from "@/api/queries";
import type { AvailabilityResponse, LandingZoneData } from "@/api/server/availability";
import { AuthorityBadge } from "@/components/evidence/badges";
import { PageBody, PageHeader } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AUTHORITY_ORDER, classifyFreshness, type FreshnessState } from "@/lib/evidence";
import { cn } from "@/lib/utils";

type OverviewLoaderData = {
  topics: ReadonlyArray<Topic>;
  sources: ReadonlyArray<Source>;
  zones: AvailabilityResponse["zones"];
};

export const Route = createFileRoute("/overview")({
  loader: async ({ context }): Promise<OverviewLoaderData> => {
    const [topicsResp, sourcesResp, availability] = await Promise.all([
      context.queryClient.ensureQueryData(topicDiscoveryQueryOptions),
      context.queryClient.ensureQueryData(sourceDiscoveryQueryOptions),
      context.queryClient.ensureQueryData(availabilityQueryOptions),
    ]);
    return {
      topics: topicsResp.topics,
      sources: sourcesResp.sources,
      zones: availability.zones,
    };
  },
  component: OverviewRoute,
});

function OverviewRoute() {
  const { topics, sources, zones } = Route.useLoaderData();

  const ledger = useMemo(() => computeLedger(topics, sources), [topics, sources]);
  const coverage = useMemo(() => zones.map(zoneCoverage), [zones]);
  const integrity = useMemo(() => computeIntegrity(sources), [sources]);
  const composition = useMemo(() => computeComposition(topics), [topics]);

  return (
    <PageBody width="comfortable" gap="compact">
      <PageHeader
        eyebrow="Platform overview"
        title="Platform state at a glance"
        badge={
          <Badge variant="brand" className="font-mono type-caption">
            demo snapshot
          </Badge>
        }
        description="Where service availability stands across landing zones, how fresh the evidence behind each answer is, and what the catalog currently covers."
        actions={
          <>
            <Button size="lg" render={<Link to="/availability" />}>
              Map availability
              <IconArrowRight className="size-4" aria-hidden />
            </Button>
            <Button size="lg" variant="outline" render={<Link to="/catalog" />}>
              Browse catalog
            </Button>
          </>
        }
      />

      <dl className="grid grid-cols-2 divide-border overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-4 sm:divide-x">
        <LedgerCell label="Capabilities" value={ledger.capabilities} hint={`${ledger.categoryCount} categories`} />
        <LedgerCell label="Landing zones" value={ledger.landingZones} hint={`${ledger.guardrails} guardrail areas`} />
        <LedgerCell label="Sources" value={ledger.sources} hint={`${ledger.authoritative} authoritative`} />
        <LedgerCell
          label="Need review"
          value={ledger.needsReview}
          hint="past review window"
          tone={ledger.needsReview > 0 ? "warning" : "default"}
        />
      </dl>

      <Panel
        title="Regional coverage"
        meta={<StatusLegend />}
        hint="Share of catalogued services already available in each location."
      >
        <div className="grid gap-x-10 gap-y-7 lg:grid-cols-2">
          {coverage.map((zone) => (
            <div key={zone.id} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-foreground">{zone.name}</h3>
                <span className="font-mono type-caption tabular-nums text-muted-foreground">
                  {zone.total} services · {zone.locations.length} locations
                </span>
              </div>
              <div className="flex flex-col gap-3">
                {zone.locations.map((loc) => (
                  <CoverageRow key={loc.id} loc={loc} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Source integrity" hint="Freshness and authority of the evidence layer.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <SegmentBar
                segments={[
                  { value: integrity.freshness.current, className: "bg-success" },
                  { value: integrity.freshness["needs-review"], className: "bg-warning" },
                  { value: integrity.freshness.stale, className: "bg-critical" },
                ]}
                total={integrity.total}
              />
              <div className="flex flex-col">
                <LegendRow dotClass="bg-success" label="Current" count={integrity.freshness.current} />
                <LegendRow
                  dotClass="bg-warning"
                  label="Needs review"
                  count={integrity.freshness["needs-review"]}
                />
                <LegendRow dotClass="bg-critical" label="Stale" count={integrity.freshness.stale} divider />
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <span className="type-caption font-medium text-muted-foreground">By authority</span>
              <div className="flex flex-col gap-2">
                {integrity.authority.map((item) => (
                  <div key={item.level} className="flex items-center justify-between gap-3">
                    <AuthorityBadge level={item.level} />
                    <span className="font-mono type-caption tabular-nums text-muted-foreground">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Catalog composition"
          hint="Approved capabilities grouped by platform domain."
        >
          {composition.categories.length === 0 ? (
            <p className="type-detail text-muted-foreground">No capabilities catalogued yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {composition.categories.map((category) => (
                <CompositionRow
                  key={category.name}
                  name={category.name}
                  count={category.count}
                  max={composition.max}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </PageBody>
  );
}

function LedgerCell({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-border px-5 py-4 first:border-t-0 [&:nth-child(2)]:border-t-0 sm:border-t-0">
      <dt className="font-mono type-caption font-medium uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "type-heading font-semibold tabular-nums leading-none tracking-[-0.02em]",
          tone === "warning" ? "text-warning-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
      <span className="type-caption text-muted-foreground">{hint}</span>
    </div>
  );
}

function Panel({
  title,
  hint,
  meta,
  children,
}: {
  title: string;
  hint?: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {hint ? <p className="type-caption leading-5 text-muted-foreground">{hint}</p> : null}
        </div>
        {meta ? <div className="shrink-0">{meta}</div> : null}
      </div>
      {children}
    </section>
  );
}

function CoverageRow({ loc }: { loc: LocationCoverage }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-sm text-foreground">{loc.label}</span>
          <span className="truncate font-mono type-caption text-muted-foreground">{loc.sub}</span>
        </span>
        <span className="shrink-0 font-mono type-caption tabular-nums text-foreground">
          {loc.percent}%
        </span>
      </div>
      <SegmentBar
        segments={[
          { value: loc.available, className: "bg-success" },
          { value: loc.planned, className: "bg-info" },
          { value: loc.interim, className: "bg-warning" },
        ]}
        total={loc.total}
      />
    </div>
  );
}

function CompositionRow({ name, count, max }: { name: string; count: number; max: number }) {
  const width = max === 0 ? 0 : Math.round((count / max) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-foreground">{name}</span>
        <span className="shrink-0 font-mono type-caption tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

type Segment = { value: number; className: string };

function SegmentBar({ segments, total }: { segments: ReadonlyArray<Segment>; total: number }) {
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="presentation">
      {segments.map((segment, index) => {
        const width = total === 0 ? 0 : (segment.value / total) * 100;
        if (width === 0) return null;
        return (
          <div
            key={index}
            className={cn("h-full first:rounded-l-full", segment.className)}
            style={{ width: `${width}%` }}
          />
        );
      })}
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <LegendDot className="bg-success" label="Available" />
      <LegendDot className="bg-info" label="Planned" />
      <LegendDot className="bg-warning" label="Interim" />
      <LegendDot className="bg-muted-foreground/40" label="Not planned" />
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 type-caption text-muted-foreground">
      <span className={cn("size-2 rounded-[3px]", className)} aria-hidden />
      {label}
    </span>
  );
}

function LegendRow({
  dotClass,
  label,
  count,
  divider,
}: {
  dotClass: string;
  label: string;
  count: number;
  divider?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1.5 text-sm",
        !divider && "border-b border-border/60",
      )}
    >
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={cn("size-2 rounded-full", dotClass)} aria-hidden />
        {label}
      </span>
      <span className="font-mono type-caption tabular-nums text-foreground">{count}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Aggregation                                                               */
/* -------------------------------------------------------------------------- */

type LedgerData = {
  capabilities: number;
  landingZones: number;
  guardrails: number;
  categoryCount: number;
  sources: number;
  authoritative: number;
  needsReview: number;
};

function computeLedger(topics: ReadonlyArray<Topic>, sources: ReadonlyArray<Source>): LedgerData {
  const capabilities = topics.filter((topic) => topic.topic_type === "capability");
  const categories = new Set(capabilities.map((topic) => topic.category));
  return {
    capabilities: capabilities.length,
    landingZones: topics.filter((topic) => topic.topic_type === "landing-zone").length,
    guardrails: topics.filter((topic) => topic.topic_type === "guardrail-area").length,
    categoryCount: categories.size,
    sources: sources.length,
    authoritative: sources.filter((source) => source.authority_level === "authoritative").length,
    needsReview: sources.filter((source) => classifyFreshness(source) !== "current").length,
  };
}

type LocationCoverage = {
  id: string;
  label: string;
  sub: string;
  available: number;
  planned: number;
  interim: number;
  total: number;
  percent: number;
};

type ZoneCoverage = {
  id: string;
  name: string;
  total: number;
  locations: ReadonlyArray<LocationCoverage>;
};

function zoneCoverage(zone: LandingZoneData): ZoneCoverage {
  const total = zone.services.length;
  const locations = zone.locations.map((loc) => {
    let available = 0;
    let planned = 0;
    let interim = 0;
    for (const service of zone.services) {
      switch (service.availability[loc.id]?.status) {
        case "available":
          available += 1;
          break;
        case "planned":
          planned += 1;
          break;
        case "interim":
          interim += 1;
          break;
        default:
          break;
      }
    }
    return {
      id: loc.id,
      label: loc.label,
      sub: loc.sub,
      available,
      planned,
      interim,
      total,
      percent: total === 0 ? 0 : Math.round((available / total) * 100),
    };
  });
  return { id: zone.id, name: zone.name, total, locations };
}

type FreshnessCounts = Record<FreshnessState, number>;

type IntegritySummary = {
  freshness: FreshnessCounts;
  authority: ReadonlyArray<{ level: AuthorityLevel; count: number }>;
  total: number;
};

function computeIntegrity(sources: ReadonlyArray<Source>): IntegritySummary {
  const freshness: FreshnessCounts = { current: 0, "needs-review": 0, stale: 0 };
  for (const source of sources) {
    freshness[classifyFreshness(source)] += 1;
  }
  const authority = AUTHORITY_ORDER.map((level) => ({
    level,
    count: sources.filter((source) => source.authority_level === level).length,
  })).filter((item) => item.count > 0);
  return { freshness, authority, total: sources.length };
}

type Composition = {
  categories: ReadonlyArray<{ name: string; count: number }>;
  max: number;
};

function computeComposition(topics: ReadonlyArray<Topic>): Composition {
  const counts = new Map<string, number>();
  for (const topic of topics) {
    if (topic.topic_type !== "capability") continue;
    counts.set(topic.category, (counts.get(topic.category) ?? 0) + 1);
  }
  const categories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 7);
  const max = categories.reduce((acc, item) => Math.max(acc, item.count), 0);
  return { categories, max };
}
