/**
 * Catalog detail · route `/catalog/$topicId`
 * ==========================================
 * "The component datasheet" — a topic reads like an electronic component's
 * datasheet: an IDENTITY BAND (icon, designation, status, trust line), a dense
 * SPECIFICATIONS table, WHERE IT RUNS (service region strip / landing-zone
 * catalog scope), GET STARTED (numbered entry tools), APPLICATION NOTES (related
 * guidance), REFERENCES (the Document Sources panel), RELATED IN DOMAIN, and a
 * FEEDBACK section. A sticky evidence rail keeps source health and the page's
 * single primary action in view.
 *
 * Generalised over every catalog topic type (service · landing-zone ·
 * security-policy) from real loader data: the topic, its context bundle (sources,
 * excerpts, warnings — typed-error tolerant), availability record, and related
 * topics. `useRecordRecent` keeps the topic in the Home "recently viewed" trail.
 */
import type { ReactNode } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { IconArrowLeft, IconArrowUpRight, IconInfoCircle, IconRoute } from "@tabler/icons-react";
import type { ContextBundleResponse, Topic, TopicDiscoveryResponse } from "@atlas/schema";

import { LastFetchChip } from "@/components/last-fetch-chip";

import {
  availabilityQueryOptions,
  contextBundleQueryOptions,
  guidanceQueryOptions,
  topicDiscoveryQueryOptions,
} from "@/api/queries";
import type { LandingZoneData } from "@/api/server/availability";
import { ContextApiError } from "@/api/contextApiError";
import { AuthorityBadge, FreshnessIndicator } from "@/components/evidence/badges";
import { FeedbackInlineForm } from "@/components/evidence/feedback-inline-form";
import { ServiceIcon } from "@/components/explore/service-icon";
import { ServiceIconFallback } from "@/components/explore/service-icon-frame";
import { useRecordRecent, type RecentItem } from "@/components/home/recently-viewed";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DeferredRegion } from "@/components/deferred-region";
import { findAvailabilityServiceForTopic } from "@/lib/availability-service";
import { relatedGuidanceForTopic, type Guidance } from "@/lib/guidance";
import { cn } from "@/lib/utils";

type LoaderData = {
  topic: Topic;
  related: ReadonlyArray<Topic>;
  guidance: ReadonlyArray<Guidance>;
  bundle: Promise<ContextBundleResponse | null>;
  zone: Promise<{ defaultZone: LandingZoneData; totalZones: number }>;
};

const TYPE_LABEL: Record<Topic["topic_type"], string> = {
  service: "Service",
  "landing-zone": "Landing zone",
  "security-policy": "Security policy",
};

export const Route = createFileRoute("/catalog/$topicId")({
  loader: async ({ context, params }): Promise<LoaderData> => {
    const topicsResp: TopicDiscoveryResponse = await context.queryClient.ensureQueryData(
      topicDiscoveryQueryOptions,
    );

    const topic = topicsResp.topics.find((entry) => entry.id === params.topicId);
    if (!topic) throw notFound();

    // Slow: defer the live bundle (no await) so navigation is instant and the
    // References + evidence-health blocks render a skeleton until it lands.
    // disclosure_level 2 resolves every anchor on each source (the default of 1
    // returns only the first), so References can show all cited sections.
    const bundle: Promise<ContextBundleResponse | null> = context.queryClient
      .ensureQueryData(contextBundleQueryOptions({ topic_id: topic.id, disclosure_level: 2 }))
      .catch((error: unknown) => {
        if (
          error instanceof ContextApiError &&
          (error.code === "topic_not_found" || error.code === "source_not_found")
        ) {
          return null;
        }
        throw error;
      });

    // Fast: guidance reads a cached projection; await it for the page shell.
    const guidances = await context.queryClient.ensureQueryData(guidanceQueryOptions);

    // Slow: availability is a live Confluence fetch + parse in the real adapter —
    // defer it (no await) so navigation is instant; the specs, where-it-runs and
    // identity icon render a skeleton until it lands.
    const zone: Promise<{ defaultZone: LandingZoneData; totalZones: number }> = context.queryClient
      .ensureQueryData(availabilityQueryOptions)
      .then((availability) => ({
        defaultZone: availability.zones[0]!,
        totalZones: availability.zones.length,
      }));

    return {
      topic,
      related: topicsResp.topics.filter(
        (entry) => entry.id !== topic.id && entry.category === topic.category,
      ),
      guidance: relatedGuidanceForTopic(guidances, topic.id),
      bundle,
      zone,
    };
  },
  component: CatalogDetailRoute,
});

const STATUS_CHIP: Record<
  Topic["status"],
  { variant: "success" | "info" | "critical"; label: string }
> = {
  active: { variant: "success", label: "General availability" },
  planned: { variant: "info", label: "Planned" },
  deprecated: { variant: "critical", label: "Deprecated" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ========================================================================== *
 * Page
 * ========================================================================== */

function CatalogDetailRoute() {
  const { topic, related, guidance, bundle, zone } = Route.useLoaderData();
  const { dataUpdatedAt } = useQuery(
    contextBundleQueryOptions({ topic_id: topic.id, disclosure_level: 2 }),
  );

  const recent: RecentItem | null =
    topic.topic_type === "service"
      ? { kind: "service", topicId: topic.id, name: topic.name }
      : topic.topic_type === "landing-zone"
        ? { kind: "landing-zone", topicId: topic.id, name: topic.name }
        : null;
  useRecordRecent(recent);

  const isService = topic.topic_type === "service";
  // locations / service / live / planned / availability spec rows all derive from
  // the deferred `zone` — computed inside the DeferredRegion blocks below so the shell
  // (identity band, get-started, application notes) paints without waiting on it.

  // Numbered main-column sections — only the ones that apply, in order.
  const sections: ReadonlyArray<{ title: string; node: ReactNode }> = [
    {
      title: "Specifications",
      node: (
        <DeferredRegion
          promise={zone}
          fallback={
            <SpecsSkeleton rows={isService || topic.topic_type === "landing-zone" ? 8 : 5} />
          }
          label="the specifications"
          retry
        >
          {({ defaultZone, totalZones }) => {
            const locations = defaultZone.locations;
            const service = isService
              ? findAvailabilityServiceForTopic(topic, defaultZone.services)
              : null;
            const live = locations.filter((loc) => {
              const status = service?.availability[loc.id]?.status;
              return status === "available" || status === "interim";
            }).length;
            const planned = locations.filter(
              (loc) => service?.availability[loc.id]?.status === "planned",
            ).length;
            const specs: ReadonlyArray<{ label: string; value: ReactNode }> = [
              { label: "Type", value: TYPE_LABEL[topic.topic_type] },
              { label: "Domain", value: topic.category },
              { label: "Status", value: STATUS_CHIP[topic.status].label },
              { label: "Owner", value: topic.owner_team },
              {
                label: "Support",
                value: <code className="font-mono text-[11.5px]">{topic.support_channel}</code>,
              },
              ...(isService
                ? [
                    { label: "Landing zone", value: defaultZone.name },
                    {
                      label: "Regions live",
                      value: (
                        <span className="tabular-nums">
                          {live} of {locations.length}
                        </span>
                      ),
                    },
                    {
                      label: "Regions planned",
                      value: <span className="tabular-nums">{planned}</span>,
                    },
                  ]
                : topic.topic_type === "landing-zone"
                  ? [
                      {
                        label: "Services",
                        value: <span className="tabular-nums">{defaultZone.services.length}</span>,
                      },
                      {
                        label: "Regions",
                        value: <span className="tabular-nums">{locations.length}</span>,
                      },
                      {
                        label: "Landing zones",
                        value: <span className="tabular-nums">{totalZones}</span>,
                      },
                    ]
                  : []),
            ];
            return (
              <dl className="grid grid-cols-1 overflow-hidden rounded-[4px] border border-border bg-card sm:grid-cols-2">
                {specs.map((spec) => (
                  <SpecRow key={spec.label} label={spec.label} value={spec.value} />
                ))}
              </dl>
            );
          }}
        </DeferredRegion>
      ),
    },
    ...(isService
      ? [
          {
            title: "Where it runs",
            node: (
              <DeferredRegion
                promise={zone}
                fallback={<WhereItRunsSkeleton />}
                label="where it runs"
              >
                {({ defaultZone }) => (
                  <WhereItRuns
                    service={findAvailabilityServiceForTopic(topic, defaultZone.services)}
                    locations={defaultZone.locations}
                  />
                )}
              </DeferredRegion>
            ),
          },
        ]
      : topic.topic_type === "landing-zone"
        ? [
            {
              title: "Catalog scope",
              node: (
                <DeferredRegion
                  promise={zone}
                  fallback={<WhereItRunsSkeleton />}
                  label="the catalog scope"
                >
                  {({ defaultZone, totalZones }) => (
                    <CatalogScope zone={defaultZone} totalZones={totalZones} />
                  )}
                </DeferredRegion>
              ),
            },
          ]
        : []),
    ...(topic.entry_tools.length > 0
      ? [{ title: "Get started", node: <GetStarted topic={topic} /> }]
      : []),
    ...(guidance.length > 0
      ? [
          {
            title: "Application notes",
            node: (
              <div className="grid gap-3 sm:grid-cols-2">
                {guidance.map((entry) => (
                  <GuidanceNote key={entry.id} guidance={entry} />
                ))}
              </div>
            ),
          },
        ]
      : []),
    {
      title: "References",
      node: (
        <DeferredRegion
          promise={bundle}
          fallback={<ReferencesSkeleton />}
          label="the references"
          retry
        >
          {(resolved) => <References sources={resolved?.sources ?? []} />}
        </DeferredRegion>
      ),
    },
    ...(related.length > 0
      ? [{ title: "Related in domain", node: <RelatedInDomain topics={related} /> }]
      : []),
    {
      title: "Help Atlas stay accurate",
      node: <FeedbackInlineForm target={{ target_type: "topic", target_id: topic.id }} />,
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-6 py-9 sm:px-8">
      <Link
        to="/catalog"
        className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-brand-ink"
      >
        <IconArrowLeft aria-hidden className="size-3.5" />
        Catalog
      </Link>

      {/* Identity band */}
      <header className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-brand-tint"
          >
            {isService ? (
              <DeferredRegion
                promise={zone}
                fallback={<ServiceIconFallback serviceId={topic.id} size="lg" />}
                errorFallback={<ServiceIconFallback serviceId={topic.id} size="lg" />}
              >
                {({ defaultZone }) => {
                  const service = findAvailabilityServiceForTopic(topic, defaultZone.services);
                  return service ? (
                    <ServiceIcon serviceId={service.id} size="lg" />
                  ) : (
                    <ServiceIconFallback serviceId={topic.id} size="lg" />
                  );
                }}
              </DeferredRegion>
            ) : (
              <ServiceIconFallback serviceId={topic.id} size="lg" />
            )}
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="w-fit font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {TYPE_LABEL[topic.topic_type]} · {topic.category}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="w-fit text-[1.75rem] font-bold leading-[1.1] tracking-[-0.025em] text-foreground">
                {topic.name}
              </h1>
              <Badge variant={STATUS_CHIP[topic.status].variant}>
                {STATUS_CHIP[topic.status].label}
              </Badge>
              <code className="font-mono text-[11.5px] text-muted-foreground">{topic.id}</code>
            </div>
            <p className="w-fit max-w-[68ch] text-[14.5px] leading-[1.55] text-muted-foreground">
              {topic.description}
            </p>
          </div>
        </div>
        {/* Trust line: every fact below is real loader data. */}
        <p className="flex w-fit flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted-foreground">
          <span className="font-semibold text-foreground">{topic.owner_team}</span>
          <Sep />
          <code className="font-mono text-[11px]">{topic.support_channel}</code>
          <Sep />
          <DeferredRegion
            promise={bundle}
            fallback={
              <span
                aria-hidden
                className="inline-block h-3 w-24 animate-pulse rounded bg-accent align-middle"
              />
            }
            errorFallback={null}
          >
            {(resolved) => {
              const sources = resolved?.sources ?? [];
              const freshest = sources
                .map((entry) => entry.source.last_reviewed_at)
                .toSorted()
                .at(-1);
              return (
                <>
                  <span className="tabular-nums">
                    {sources.length} source{sources.length === 1 ? "" : "s"}
                  </span>
                  {freshest ? (
                    <>
                      <Sep />
                      <span className="tabular-nums">reviewed {formatDate(freshest)}</span>
                    </>
                  ) : null}
                </>
              );
            }}
          </DeferredRegion>
          {dataUpdatedAt ? (
            <>
              <Sep />
              <LastFetchChip updatedAt={dataUpdatedAt} />
            </>
          ) : null}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          {sections.map((section, i) => (
            <section key={section.title}>
              <DatasheetHead index={String(i + 1).padStart(2, "0")} title={section.title} />
              {section.node}
            </section>
          ))}
        </div>

        {/* Evidence rail — sticky, the page's single primary action lives here */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[76px]">
          {topic.entry_tools[0] ? (
            <div className="flex flex-col gap-3 rounded-[4px] border border-border bg-card p-4">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Actions
              </span>
              <a
                href={topic.entry_tools[0].url}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 items-center justify-center rounded-[3px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {topic.entry_tools[0].label}
              </a>
              {topic.entry_tools.slice(1, 3).map((tool) => (
                <a
                  key={tool.url}
                  href={tool.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 items-center justify-center rounded-[3px] border border-border-strong bg-card px-3.5 text-[13px] font-semibold text-foreground transition-colors hover:border-primary hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {tool.label}
                </a>
              ))}
            </div>
          ) : null}

          <div className="flex flex-col gap-2.5 rounded-[4px] border border-border bg-card p-4">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Evidence health
            </span>
            <DeferredRegion
              promise={bundle}
              fallback={<EvidenceHealthSkeleton />}
              label="evidence health"
            >
              {(resolved) => {
                const sources = resolved?.sources ?? [];
                const warnings = resolved?.warnings ?? [];
                return (
                  <>
                    <RailStat label="Registered sources" value={String(sources.length)} />
                    <RailStat
                      label="Anchored references"
                      value={String(resolved?.anchor_references.length ?? 0)}
                    />
                    <RailStat label="Open warnings" value={String(warnings.length)} />
                    {warnings.map((warning) => (
                      <p
                        key={`${warning.code}-${warning.source_id ?? ""}`}
                        className="flex items-start gap-2 rounded-[3px] border border-warning/50 bg-warning-tint px-3 py-2 text-[12px] leading-[1.5] text-warning-ink"
                      >
                        <IconInfoCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        {warning.message}
                      </p>
                    ))}
                  </>
                );
              }}
            </DeferredRegion>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ========================================================================== *
 * Sections
 * ========================================================================== */

function WhereItRuns({
  service,
  locations,
}: {
  service: ReturnType<typeof findAvailabilityServiceForTopic>;
  locations: LandingZoneData["locations"];
}) {
  return (
    <>
      {service ? (
        <div className="grid grid-cols-1 overflow-hidden rounded-[4px] border border-border bg-card sm:grid-cols-2 lg:grid-cols-5 lg:divide-x lg:divide-border max-lg:divide-y max-lg:divide-border">
          {locations.map((loc) => {
            const cell = service.availability[loc.id];
            const status = cell?.status ?? "not-planned";
            return (
              <div key={loc.id} className="flex flex-col gap-1 px-3.5 py-3">
                <span className="text-[13px] font-semibold text-foreground">{loc.label}</span>
                <span className="text-[11.5px] text-muted-foreground">{loc.sub}</span>
                <span className="mt-1 inline-flex items-center gap-1.5 text-[12px]">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 rounded-full",
                      status === "available" && "bg-success",
                      status === "interim" && "bg-warning",
                      status === "planned" && "bg-warning",
                      status === "not-planned" &&
                        "bg-transparent shadow-[inset_0_0_0_1.5px_var(--color-border-strong)]",
                    )}
                  />
                  <span className="text-muted-foreground">
                    {status === "available" && "Available"}
                    {status === "interim" && (cell?.note ?? "Limited")}
                    {status === "planned" && (cell?.note ? `Planned · ${cell.note}` : "Planned")}
                    {status === "not-planned" && "Not planned"}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-[4px] border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
          No availability record is registered for this service yet. Region rollout will appear here
          once the projection includes it.
        </p>
      )}
      <Link
        to="/availability"
        className="mt-2 flex w-fit items-center gap-1 text-[12.5px] font-semibold text-brand-ink hover:underline"
      >
        Open in availability map
        <IconArrowUpRight aria-hidden className="size-3.5" />
      </Link>
    </>
  );
}

function CatalogScope({ zone, totalZones }: { zone: LandingZoneData; totalZones: number }) {
  return (
    <>
      <p className="rounded-[4px] border border-border bg-card px-4 py-3 text-[13px] leading-[1.55] text-muted-foreground">
        <span className="font-mono font-bold text-foreground">{zone.services.length}</span> services
        across <span className="font-mono font-bold text-foreground">{zone.locations.length}</span>{" "}
        regions and outposts
        {totalZones > 1 ? ` (${totalZones} landing zones)` : ""}. Filter to this zone on the
        availability map.
      </p>
      <Link
        to="/availability"
        className="mt-2 flex w-fit items-center gap-1 text-[12.5px] font-semibold text-brand-ink hover:underline"
      >
        Open in availability map
        <IconArrowUpRight aria-hidden className="size-3.5" />
      </Link>
    </>
  );
}

function GetStarted({ topic }: { topic: Topic }) {
  return (
    <ol className="overflow-hidden rounded-[4px] border border-border bg-card">
      {topic.entry_tools.map((tool, i) => (
        <li key={tool.label} className={cn(i > 0 && "border-t border-border")}>
          <a
            href={tool.url}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="w-7 shrink-0 text-right text-[15px] font-bold tabular-nums text-muted-foreground/70">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13.5px] font-semibold text-foreground group-hover:text-brand-ink">
                {tool.label}
              </span>
              <span className="truncate font-mono text-[10.5px] text-muted-foreground">
                {tool.url}
              </span>
            </span>
            <IconArrowUpRight
              aria-hidden
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-ink"
            />
          </a>
        </li>
      ))}
    </ol>
  );
}

function References({ sources }: { sources: ContextBundleResponse["sources"] }) {
  if (sources.length === 0) {
    return (
      <p className="rounded-[4px] border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
        No sources are registered against this topic yet. Claims on this page would be unverifiable,
        so Atlas shows none.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-[4px] border border-border bg-card">
      {sources.map((entry, i) => (
        <article
          key={entry.source.id}
          className={cn("flex gap-4 px-4 py-4", i > 0 && "border-t border-border")}
        >
          <span className="w-8 shrink-0 text-right text-[1.25rem] font-bold leading-none tabular-nums text-muted-foreground/60">
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="text-[13.5px] font-bold text-foreground">{entry.source.title}</span>
              <code className="font-mono text-[10.5px] text-muted-foreground">
                {entry.source.source_class} · {entry.source.id}
              </code>
            </div>
            <p className="text-[12.5px] leading-[1.5] text-muted-foreground">
              {entry.selection_rationale}
            </p>
            {entry.excerpts.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {entry.excerpts.map((excerpt, ei) => (
                  <p
                    key={excerpt.citation.anchor_id ?? excerpt.anchor_id ?? ei}
                    className="border-l border-border pl-3 text-[12.5px] italic leading-[1.5] text-muted-foreground"
                  >
                    “{excerpt.text}”
                  </p>
                ))}
              </div>
            ) : null}
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <AuthorityBadge level={entry.source.authority_level} />
              <FreshnessIndicator source={entry.source} />
              <span className="text-[11.5px] text-muted-foreground">{entry.source.steward}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function RelatedInDomain({ topics }: { topics: ReadonlyArray<Topic> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {topics.map((entry) => (
        <Link
          key={entry.id}
          to={entry.topic_type === "security-policy" ? "/policies/$policyId" : "/catalog/$topicId"}
          params={
            entry.topic_type === "security-policy" ? { policyId: entry.id } : { topicId: entry.id }
          }
          className="group flex flex-col gap-1 rounded-[4px] border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-[0_1px_2px_oklch(40%_0.05_264.18/0.05),0_6px_16px_oklch(40%_0.05_264.18/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-[13.5px] font-bold text-foreground group-hover:text-brand-ink">
            {entry.name}
          </span>
          <span className="line-clamp-2 text-[12.5px] leading-[1.5] text-muted-foreground">
            {entry.description}
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ========================================================================== *
 * Pieces
 * ========================================================================== */

function Sep() {
  return (
    <span aria-hidden className="text-border-strong">
      ·
    </span>
  );
}

function DatasheetHead({ index, title }: { index: string; title: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2.5">
      <span className="font-mono text-[11px] font-semibold tabular-nums text-muted-foreground/70">
        {index}
      </span>
      <h2 className="w-fit text-[1.0625rem] font-bold tracking-[-0.015em] text-foreground">
        {title}
      </h2>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border px-4 py-2.5 last:border-b-0 sm:nth-last-2:border-b-0 sm:odd:border-r sm:odd:border-r-border">
      <dt className="text-[12px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right text-[13px] font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function RailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      <span className="text-[14px] font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

/** Placeholder for the deferred Specifications table while availability resolves. */
function SpecsSkeleton({ rows }: { rows: number }) {
  return (
    <dl
      aria-hidden
      className="grid grid-cols-1 overflow-hidden rounded-[4px] border border-border bg-card sm:grid-cols-2"
    >
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-baseline justify-between gap-4 border-b border-border px-4 py-2.5 last:border-b-0"
        >
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </dl>
  );
}

/** Placeholder for the deferred "Where it runs" / "Catalog scope" section. */
function WhereItRunsSkeleton() {
  return <Skeleton aria-hidden className="h-[124px] w-full rounded-[4px]" />;
}

/** Placeholder for the deferred References list — a couple of source-card rows. */
function ReferencesSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-[4px] border border-border bg-card">
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className={cn("flex gap-4 px-4 py-4", i > 0 && "border-t border-border")}>
          <Skeleton className="size-6 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-full max-w-[40ch]" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder for the deferred evidence-health rail — three stat rows. */
function EvidenceHealthSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2.5">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3.5 w-6" />
        </div>
      ))}
    </div>
  );
}

function GuidanceNote({ guidance }: { guidance: Guidance }) {
  const steps = guidance.steps.filter((step) => step.kind !== "destination");
  return (
    <Link
      to="/guidance/$guidanceId"
      params={{ guidanceId: guidance.id }}
      className="group flex flex-col gap-2 rounded-[4px] border border-border bg-card p-4 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-[0_1px_2px_oklch(40%_0.05_264.18/0.05),0_6px_16px_oklch(40%_0.05_264.18/0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center gap-2 text-[13.5px] font-bold text-foreground group-hover:text-brand-ink">
        <IconRoute aria-hidden className="size-4 text-muted-foreground" />
        {guidance.title}
      </span>
      <span className="line-clamp-2 text-[12.5px] leading-[1.5] text-muted-foreground">
        {guidance.objective}
      </span>
      <span className="mt-auto flex items-center gap-2 pt-1 text-[11.5px] text-muted-foreground">
        <span className="tabular-nums">{steps.length} steps</span>
        <Sep />
        <span>{guidance.owner.team}</span>
      </span>
    </Link>
  );
}
