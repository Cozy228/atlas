/**
 * Service detail · route `/service/$provider/$id` (canonical `{kind}/{slug}`)
 * ==========================================================================
 * "The component datasheet" — a service reads like an electronic component's
 * datasheet: an IDENTITY BAND (icon, designation, status, trust line), a dense
 * SPECIFICATIONS table, WHERE IT RUNS (service region strip), GET STARTED
 * (numbered entry tools), APPLICATION NOTES (related guidance), REFERENCE
 * DOCUMENTS (the resource projection's discovery links), RELATED IN DOMAIN, and
 * a FEEDBACK section. A sticky evidence rail keeps governed-evidence health and
 * the page's single primary action in view.
 *
 * Resource-first (plan 020 15d, ADR-0015): the page is addressed by the Resource
 * `{kind}/{slug}` (here `service/{provider}/{id}`), NOT a topic id. It composes
 * the Resource RECORD (presentation metadata migrated off the Topic) + the live
 * resource projection (governed sections + reference-only discovery links) + the
 * availability record. Security policies live at `/policies/$policyId` and
 * landing zones are the availability scope (plan 019) — neither lands here.
 */
import type { ReactNode } from "react";
import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import {
  IconArrowLeft,
  IconArrowUpRight,
  IconExternalLink,
  IconFileText,
  IconInfoCircle,
  IconLock,
  IconRoute,
} from "@tabler/icons-react";
import type {
  DiscoveredReference,
  EntryTool,
  ResourceContextResponse,
  ResourceRecordResponse,
  ResourceStatus,
} from "@atlas/schema";

import {
  availabilityQueryOptions,
  guidanceQueryOptions,
  resourceCatalogQueryOptions,
  resourceContextQueryOptions,
  resourceRecordQueryOptions,
} from "@/api/queries";
import type { AvailabilityRecord, LandingZoneAvailability } from "@/api/server/availability";
import { FeedbackInlineForm } from "@/components/evidence/feedback-inline-form";
import { ServiceIcon } from "@/components/explore/service-icon";
import { ServiceIconFallback } from "@/components/explore/service-icon-frame";
import { useRecordRecent } from "@/components/home/recently-viewed";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DeferredRegion } from "@/components/deferred-region";
import { DEFAULT_LANDING_ZONE_ID } from "@/components/landing-zone/context";
import { DataNotAvailableForZone } from "@/components/landing-zone/data-not-available";
import { useCurrentLandingZoneRecord } from "@/components/landing-zone/landing-zone-gate";
import {
  findAvailabilityServiceById,
  serviceRouteParamsForResource,
} from "@/lib/availability-service";
import { relatedGuidanceForResource, type Guidance } from "@/lib/guidance";
import { deferUnlessCached } from "@/lib/deferred-cache";
import { cn } from "@/lib/utils";

/** A related service resource shown in "Related in domain": its canonical
 *  address plus the display copy. */
type RelatedService = { provider: string; id: string; name: string; description: string };

type LoaderData = {
  record: ResourceRecordResponse;
  slug: string;
  serviceId: string;
  related: ReadonlyArray<RelatedService>;
  guidance: ReadonlyArray<Guidance>;
  zone: Promise<{ defaultZone: LandingZoneAvailability; totalZones: number }>;
  /** The live resource projection (governance + reference-only discovery links).
   *  `null` when the live read fails. */
  projection: Promise<ResourceContextResponse | null>;
};

export const Route = createFileRoute("/service/$provider/$id")({
  // The datasheet skeleton covers the loader window (below `record` is awaited to
  // gate the 404 + fill the identity band). Without it the router shows a blank
  // shell while that per-slug fetch runs, because the in-component skeletons only
  // cover the DEFERRED data — they don't exist until the component mounts, which
  // the await blocks. `pendingMs` keeps a warm/instant nav from flashing it.
  pendingComponent: ServiceDetailPending,
  pendingMs: 120,
  loader: async ({ context, params }): Promise<LoaderData> => {
    const slug = `${params.provider}/${params.id}`;
    const qc = context.queryClient;

    // Kick the slow live reads off FIRST so they fetch in parallel with the
    // awaited `record` below (neither depends on it). `deferUnlessCached`: a cache
    // HIT resolves synchronously (a revisit paints the real datasheet with no
    // skeleton flash), a MISS keeps the live promise so the region shows its
    // skeleton while the genuinely-slow fetch runs.
    const zone = deferUnlessCached(
      qc,
      availabilityQueryOptions.queryKey,
      () => qc.ensureQueryData(availabilityQueryOptions),
      // The datasheet shows the default (only wired) LZ's grid until per-LZ
      // resource scope lands (plan 023). Match by the LZ id, not the URL
      // `provider` (a cloud) — post-rename zone ids are LZ ids (awsf).
      (availability) => ({
        defaultZone:
          availability.zones.find((z) => z.id === DEFAULT_LANDING_ZONE_ID) ??
          availability.zones[0]!,
        totalZones: availability.zones.length,
      }),
    );

    // The live resource projection, keyed by the canonical slug. Reference
    // discovery + governed sections are live, so a failure degrades to null and
    // the blocks show an honest gap (never the region's error card).
    const projectionOptions = resourceContextQueryOptions({ kind: "service", slug });
    const projection = deferUnlessCached(
      qc,
      projectionOptions.queryKey,
      () => qc.ensureQueryData(projectionOptions).catch(() => null),
      (p) => p,
    );

    // Presentation metadata (durable, ADR-0015 §2) — awaited for the page shell
    // (identity band + 404 gate). The `pendingComponent` covers this window.
    const record = await qc
      .ensureQueryData(resourceRecordQueryOptions({ kind: "service", slug }))
      .catch(() => null);
    if (!record) throw notFound();

    // Sibling services share this resource's category (a facet attribute).
    // Siblings come straight from the discovered catalog by category.
    const catalogResp = await qc.ensureQueryData(resourceCatalogQueryOptions);

    const guidances = await qc.ensureQueryData(guidanceQueryOptions);

    // Related in domain: sibling service resources sharing this resource's
    // category (a facet attribute), each addressed by its own canonical slug.
    const related: ReadonlyArray<RelatedService> = record.category
      ? catalogResp.resources
          .filter(
            (entry) =>
              entry.slug !== record.slug &&
              entry.kind === "service" &&
              entry.category === record.category,
          )
          .map((sibling) => siblingService(sibling, params.provider))
      : [];

    return {
      record,
      slug,
      serviceId: params.id,
      related,
      // Guidance association is keyed by the resource slug (guidance
      // `applies_to.services` holds slugs).
      guidance: relatedGuidanceForResource(guidances, record.slug),
      zone,
      projection,
    };
  },
  component: ServiceDetailRoute,
});

/** Map a sibling service Resource to its canonical resource address (shared slug
 *  mapping), keeping the current page's provider. */
function siblingService(resource: ResourceRecordResponse, provider: string): RelatedService {
  const { id } = serviceRouteParamsForResource(resource);
  return { provider, id, name: resource.name, description: resource.description ?? "" };
}

const STATUS_CHIP: Record<
  ResourceStatus,
  { variant: "success" | "info" | "critical"; label: string }
> = {
  active: { variant: "success", label: "General availability" },
  planned: { variant: "info", label: "Planned" },
  deprecated: { variant: "critical", label: "Deprecated" },
};

const DEFAULT_STATUS: ResourceStatus = "active";

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

function ServiceDetailRoute() {
  const { record, slug, serviceId, related, guidance, zone, projection } = Route.useLoaderData();
  const entryTools: ReadonlyArray<EntryTool> = record.entry_tools ?? [];
  const status = record.status ?? DEFAULT_STATUS;
  const category = record.category ?? "Service";
  // Feedback targets the canonical resource id ({kind}/{slug}).
  const feedbackTargetId = record.id;

  useRecordRecent({ kind: "service", slug, name: record.name });

  // Per-LZ honesty (plan 021 C2, ADR-0006): an unwired landing zone shows the
  // honest dead-end here too, never the default zone's datasheet.
  const landingZone = useCurrentLandingZoneRecord();
  if (landingZone?.dataStatus === "not-available") {
    return (
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7 px-6 py-9 sm:px-8">
        <Link
          to="/catalog"
          className="flex w-fit items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-brand-ink"
        >
          <IconArrowLeft aria-hidden className="size-3.5" />
          Catalog
        </Link>
        <DataNotAvailableForZone zoneName={landingZone.name} surface="service" />
      </div>
    );
  }

  // Numbered main-column sections — only the ones that apply, in order.
  const sections: ReadonlyArray<{ title: string; node: ReactNode }> = [
    {
      title: "Specifications",
      node: (
        <DeferredRegion
          promise={zone}
          fallback={<SpecsSkeleton rows={8} />}
          label="the specifications"
          retry
        >
          {({ defaultZone }) => {
            const locations = defaultZone.locations;
            const service = findAvailabilityServiceById(defaultZone.services, serviceId);
            const live = locations.filter((loc) => {
              const cellStatus = service?.availability[loc.id]?.status;
              return cellStatus === "available" || cellStatus === "interim";
            }).length;
            const planned = locations.filter(
              (loc) => service?.availability[loc.id]?.status === "planned",
            ).length;
            const specs: ReadonlyArray<{ label: string; value: ReactNode }> = [
              { label: "Type", value: "Service" },
              { label: "Domain", value: category },
              { label: "Status", value: STATUS_CHIP[status].label },
              { label: "Owner", value: record.owner_team ?? "—" },
              {
                label: "Support",
                value: record.support_channel ? (
                  <code className="font-mono text-[11.5px]">{record.support_channel}</code>
                ) : (
                  "—"
                ),
              },
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
    {
      title: "Where it runs",
      node: (
        <DeferredRegion promise={zone} fallback={<WhereItRunsSkeleton />} label="where it runs">
          {({ defaultZone }) => (
            <WhereItRuns
              service={findAvailabilityServiceById(defaultZone.services, serviceId)}
              locations={defaultZone.locations}
            />
          )}
        </DeferredRegion>
      ),
    },
    ...(entryTools.length > 0
      ? [{ title: "Get started", node: <GetStarted entryTools={entryTools} /> }]
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
      title: "Reference documents",
      node: (
        <DeferredRegion
          promise={projection}
          fallback={<ReferencesSkeleton />}
          label="the reference documents"
          retry
        >
          {(resolved) => <ReferenceDocs projection={resolved} />}
        </DeferredRegion>
      ),
    },
    ...(related.length > 0
      ? [{ title: "Related in domain", node: <RelatedInDomain services={related} /> }]
      : []),
    {
      title: "Help us keep this accurate",
      node: (
        <FeedbackInlineForm target={{ target_type: "resource", target_id: feedbackTargetId }} />
      ),
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
            <DeferredRegion
              promise={zone}
              fallback={<ServiceIconFallback serviceId={serviceId} size="lg" />}
              errorFallback={<ServiceIconFallback serviceId={serviceId} size="lg" />}
            >
              {({ defaultZone }) => {
                const service = findAvailabilityServiceById(defaultZone.services, serviceId);
                return service ? (
                  <ServiceIcon serviceId={service.id} size="lg" />
                ) : (
                  <ServiceIconFallback serviceId={serviceId} size="lg" />
                );
              }}
            </DeferredRegion>
          </span>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="w-fit font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Service · {category}
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="w-fit text-[1.75rem] font-bold leading-[1.1] tracking-[-0.025em] text-foreground">
                {record.name}
              </h1>
              <Badge variant={STATUS_CHIP[status].variant}>{STATUS_CHIP[status].label}</Badge>
            </div>
            {record.description ? (
              <p className="w-fit max-w-[68ch] text-[14.5px] leading-[1.55] text-muted-foreground">
                {record.description}
              </p>
            ) : null}
          </div>
        </div>
        {/* Trust line: owner, support, and the live discovery count. */}
        <p className="flex w-fit flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted-foreground">
          {record.owner_team ? (
            <span className="font-semibold text-foreground">{record.owner_team}</span>
          ) : null}
          {record.owner_team && record.support_channel ? <Sep /> : null}
          {record.support_channel ? (
            <code className="font-mono text-[11px]">{record.support_channel}</code>
          ) : null}
          <DeferredRegion promise={projection} fallback={null} errorFallback={null}>
            {(resolved) => {
              const count = resolved?.references.length ?? 0;
              return count > 0 ? (
                <>
                  <Sep />
                  <span className="tabular-nums">
                    {count} reference doc{count === 1 ? "" : "s"}
                  </span>
                </>
              ) : null;
            }}
          </DeferredRegion>
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

        {/* Action rail — sticky. Consolidates the page's actionable links: the
            Get-started entry tools and the discovered reference documents. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[76px]">
          <div className="flex flex-col gap-3 rounded-[4px] border border-border bg-card p-4">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Actions
            </span>
            {entryTools[0] ? (
              <a
                href={entryTools[0].url}
                target="_blank"
                rel="noreferrer"
                className="flex h-9 items-center justify-center rounded-[3px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {entryTools[0].label}
              </a>
            ) : null}
            {entryTools.slice(1, 3).map((tool) => (
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
            <DeferredRegion promise={projection} fallback={null} errorFallback={null}>
              {(resolved) => {
                const references = resolved?.references ?? [];
                if (references.length === 0) return null;
                return (
                  <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      Reference documents
                    </span>
                    {references.map((reference) => (
                      <a
                        key={reference.url}
                        href={reference.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center gap-1.5 rounded-[3px] px-1 py-1 text-[12.5px] text-foreground transition-colors hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {reference.title}
                        </span>
                        <IconExternalLink
                          aria-hidden
                          className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-ink"
                        />
                      </a>
                    ))}
                  </div>
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
  service: AvailabilityRecord | null;
  locations: LandingZoneAvailability["locations"];
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

function GetStarted({ entryTools }: { entryTools: ReadonlyArray<EntryTool> }) {
  return (
    <ol className="overflow-hidden rounded-[4px] border border-border bg-card">
      {entryTools.map((tool, i) => (
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

const DOC_TYPE_META: Record<
  DiscoveredReference["doc_type"],
  { label: string; order: number; variant: "info" | "neutral" | "outline" }
> = {
  design: { label: "Design", order: 0, variant: "info" },
  "user-guide": { label: "User guide", order: 1, variant: "neutral" },
  policy: { label: "Policy", order: 2, variant: "outline" },
};

function lastChecked(iso: string | null | undefined): string {
  return iso ? ` (last checked ${formatDate(iso)})` : "";
}

/**
 * Reference-only discovery block (plan 017). Surfaces the Confluence pages
 * discovered for a service as doc-type-categorized links, clearly labeled
 * reference-only (Atlas links them but cannot read their bodies). Honest about
 * governance (unconfigured) and discovery state (stale / unavailable / partial)
 * — never a silent stale link list.
 */
function ReferenceDocs({ projection }: { projection: ResourceContextResponse | null }) {
  if (!projection) {
    return (
      <p className="rounded-[4px] border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
        No reference documents are discoverable for this service yet.
      </p>
    );
  }

  const { references, referenceDiscovery } = projection;
  const status = referenceDiscovery?.status ?? null;
  // Empty governed sections carry the same signal the old `governance:
  // "unconfigured"` flag did: no curated evidence, only reference-only links.
  const hasGovernedSections = Object.keys(projection.sections).length > 0;

  const notices: ReactNode[] = [];
  if (!hasGovernedSections) {
    notices.push(
      <ReferenceNotice key="governance" tone="info">
        No governed sources are configured for this service yet. The links below are reference-only
        — discovered by convention, not curated evidence.
      </ReferenceNotice>,
    );
  }
  if (status === "unavailable") {
    notices.push(
      <ReferenceNotice key="unavailable" tone="warning">
        Reference discovery is unavailable right now
        {lastChecked(referenceDiscovery?.last_observed_at)}. Cloud DevEx Portal shows no links
        rather than serve stale ones.
      </ReferenceNotice>,
    );
  } else if (status === "stale") {
    notices.push(
      <ReferenceNotice key="stale" tone="warning">
        These links may be out of date{lastChecked(referenceDiscovery?.last_observed_at)} — a
        refresh is in progress.
      </ReferenceNotice>,
    );
  }
  if (referenceDiscovery?.incomplete) {
    notices.push(
      <ReferenceNotice key="incomplete" tone="warning">
        Too many matches to list them all — this is a partial set.
      </ReferenceNotice>,
    );
  }

  const ordered = [...references].sort(
    (a, b) => DOC_TYPE_META[a.doc_type].order - DOC_TYPE_META[b.doc_type].order,
  );

  return (
    <div className="flex flex-col gap-3">
      {notices}
      {ordered.length === 0 ? (
        <p className="rounded-[4px] border border-dashed border-border bg-card px-4 py-5 text-[13px] text-muted-foreground">
          {status === "unavailable"
            ? "Discovery could not run, so Cloud DevEx Portal shows no links rather than fabricate them."
            : "No documentation pages matched this service by convention yet."}
        </p>
      ) : (
        <>
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <IconLock aria-hidden className="size-3.5 shrink-0" />
            Reference-only — Cloud DevEx Portal links these pages but cannot read their contents
            (your Confluence credentials govern access).
          </p>
          <div className="overflow-hidden rounded-[4px] border border-border bg-card">
            {ordered.map((reference, i) => (
              <ReferenceDocRow key={reference.url} reference={reference} divider={i > 0} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ReferenceNotice({ tone, children }: { tone: "info" | "warning"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-[4px] border px-3.5 py-2.5 text-[12.5px] leading-[1.5]",
        tone === "warning"
          ? "border-warning/50 bg-warning-tint text-warning-ink"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      <IconInfoCircle aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

function ReferenceDocRow({
  reference,
  divider,
}: {
  reference: DiscoveredReference;
  divider: boolean;
}) {
  const meta = DOC_TYPE_META[reference.doc_type];
  return (
    <a
      href={reference.url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        divider && "border-t border-border",
      )}
    >
      <IconFileText aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13.5px] font-semibold text-foreground group-hover:text-brand-ink">
          {reference.title}
        </span>
        <span className="truncate font-mono text-[10.5px] text-muted-foreground">
          {reference.url}
        </span>
      </span>
      <Badge variant={meta.variant}>{meta.label}</Badge>
      <IconExternalLink
        aria-hidden
        className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-ink"
      />
    </a>
  );
}

function RelatedInDomain({ services }: { services: ReadonlyArray<RelatedService> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {services.map((entry) => (
        <Link
          key={`${entry.provider}/${entry.id}`}
          to="/service/$provider/$id"
          params={{ provider: entry.provider, id: entry.id }}
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

/** Full-page datasheet skeleton shown by the router while the loader awaits the
 *  per-slug `record` (route `pendingComponent`). Mirrors the real layout — back
 *  link, identity band, the first numbered sections, and the action rail — so the
 *  wait reads as "this page is loading", not a blank shell. It reuses the same
 *  section skeletons the in-component deferred regions use, so the two loading
 *  phases (pre-mount here, post-mount there) look continuous. */
function ServiceDetailPending() {
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
          <Skeleton aria-hidden className="size-14 shrink-0 rounded-lg" />
          <div className="flex min-w-0 flex-col gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-full max-w-[52ch]" />
          </div>
        </div>
        <Skeleton className="h-3.5 w-72" />
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <DatasheetHead index="01" title="Specifications" />
            <SpecsSkeleton rows={8} />
          </section>
          <section>
            <DatasheetHead index="02" title="Where it runs" />
            <WhereItRunsSkeleton />
          </section>
          <section>
            <DatasheetHead index="03" title="Reference documents" />
            <ReferencesSkeleton />
          </section>
        </div>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-[76px]">
          <div className="flex flex-col gap-3 rounded-[4px] border border-border bg-card p-4">
            <Skeleton aria-hidden className="h-2.5 w-16" />
            <Skeleton aria-hidden className="h-9 w-full rounded-[3px]" />
            <Skeleton aria-hidden className="h-9 w-full rounded-[3px]" />
          </div>
        </aside>
      </div>
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

/** Placeholder for the deferred "Where it runs" section. */
function WhereItRunsSkeleton() {
  return <Skeleton aria-hidden className="h-[124px] w-full rounded-[4px]" />;
}

/** Placeholder for the deferred Reference documents list. */
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

function GuidanceNote({ guidance }: { guidance: Guidance }) {
  const steps = guidance.steps;
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
