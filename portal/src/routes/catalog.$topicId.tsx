import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { IconArrowUpRight, IconLink } from "@tabler/icons-react";
import type { ContextBundleResponse, Topic, TopicDiscoveryResponse } from "@atlas/schema";

import {
  availabilityQueryOptions,
  contextBundleQueryOptions,
  topicDiscoveryQueryOptions,
} from "@/api/queries";
import type { AvailabilityResponse, LandingZoneData } from "@/api/server/availability";
import { ContextApiError } from "@/api/contextApiError";
import { AvailabilityStrip } from "@/components/detail/availability-strip";
import {
  BackLink,
  DetailHeader,
  DetailLayout,
  DetailMetaCard,
  DetailSection,
} from "@/components/detail/detail-shell";
import { EntryToolsGrid } from "@/components/detail/entry-tools-grid";
import { EvidenceSection } from "@/components/detail/evidence-section";
import { RelatedColumn } from "@/components/detail/related-column";
import { FeedbackInlineForm } from "@/components/evidence/feedback-inline-form";
import { RelatedGuidance } from "@/components/guidance/related-guidance";
import { ServiceIcon } from "@/components/explore/service-icon";
import { useRecordRecent, type RecentItem } from "@/components/home/recently-viewed";
import { Badge } from "@/components/ui/badge";
import { PageBody } from "@/components/page-section";
import { relatedGuidanceForTopic } from "@/lib/guidance";
import { findAvailabilityServiceForTopic } from "@/lib/capability-service";
import { cn } from "@/lib/utils";

type LoaderData = {
  topic: Topic;
  related: ReadonlyArray<Topic>;
  /** Platform governance context for capabilities (derived from the topic list). */
  guardrailAreas: ReadonlyArray<Topic>;
  landingZones: ReadonlyArray<Topic>;
  bundle: ContextBundleResponse | null;
  defaultZone: LandingZoneData;
  totalZones: number;
};

const TYPE_LABEL: Record<Topic["topic_type"], string> = {
  capability: "Capability",
  "landing-zone": "Landing zone",
  "guardrail-area": "Guardrail area",
};

export const Route = createFileRoute("/catalog/$topicId")({
  loader: async ({ context, params }): Promise<LoaderData> => {
    const [topicsResp, availability]: [TopicDiscoveryResponse, AvailabilityResponse] =
      await Promise.all([
        context.queryClient.ensureQueryData(topicDiscoveryQueryOptions),
        context.queryClient.ensureQueryData(availabilityQueryOptions),
      ]);

    const topic = topicsResp.topics.find((entry) => entry.id === params.topicId);
    if (!topic) {
      throw notFound();
    }

    let bundle: ContextBundleResponse | null = null;
    try {
      bundle = await context.queryClient.ensureQueryData(
        contextBundleQueryOptions({ topic_id: topic.id }),
      );
    } catch (error) {
      if (
        error instanceof ContextApiError &&
        (error.code === "topic_not_found" || error.code === "source_not_found")
      ) {
        bundle = null;
      } else {
        throw error;
      }
    }

    const related = topicsResp.topics.filter(
      (entry) => entry.id !== topic.id && entry.category === topic.category,
    );

    return {
      topic,
      related,
      guardrailAreas: topicsResp.topics.filter((entry) => entry.topic_type === "guardrail-area"),
      landingZones: topicsResp.topics.filter((entry) => entry.topic_type === "landing-zone"),
      bundle,
      defaultZone: availability.zones[0]!,
      totalZones: availability.zones.length,
    };
  },
  component: CatalogDetailRoute,
});

function CatalogDetailRoute() {
  const { topic, related, guardrailAreas, landingZones, bundle, defaultZone, totalZones } =
    Route.useLoaderData();

  const recent: RecentItem | null =
    topic.topic_type === "capability"
      ? { kind: "capability", topicId: topic.id, name: topic.name }
      : topic.topic_type === "landing-zone"
        ? { kind: "landing-zone", topicId: topic.id, name: topic.name }
        : null;
  useRecordRecent(recent);

  const isCapability = topic.topic_type === "capability";
  const isLandingZone = topic.topic_type === "landing-zone";

  const service = isCapability ? findAvailabilityServiceForTopic(topic, defaultZone.services) : null;
  const relatedCapabilities =
    topic.topic_type !== "capability"
      ? related.filter((entry) => entry.topic_type === "capability")
      : [];
  const relatedLandingZones =
    topic.topic_type !== "landing-zone"
      ? related.filter((entry) => entry.topic_type === "landing-zone")
      : [];
  const relatedGuardrails =
    topic.topic_type !== "guardrail-area"
      ? related.filter((entry) => entry.topic_type === "guardrail-area")
      : [];
  const guidance = relatedGuidanceForTopic(topic.id);
  const primaryTool = topic.entry_tools[0];
  const hasRelationships =
    relatedCapabilities.length > 0 ||
    relatedLandingZones.length > 0 ||
    relatedGuardrails.length > 0;
  const hasGovernance =
    isCapability && (guardrailAreas.length > 0 || landingZones.length > 0);

  const updated = freshestObserved(bundle);

  return (
    <PageBody width="comfortable" gap="compact">
      <BackLink to="/catalog" label="Back to catalog" />

      <DetailHeader
        eyebrow={`${TYPE_LABEL[topic.topic_type]} · ${topic.category}`}
        title={topic.name}
        description={topic.description}
        leading={service ? <ServiceIcon serviceId={service.id} size="hero" /> : undefined}
        badges={<StatusBadge status={topic.status} />}
      />

      <DetailLayout
        main={
          <>
            {/* Tier 1 — can I use it, where, and how do I start. */}
            {isCapability ? (
              <DetailSection title="Where this is available">
                <AvailabilityStrip service={service} locations={defaultZone.locations} />
              </DetailSection>
            ) : null}

            {topic.entry_tools.length > 0 ? (
              <DetailSection title="Entry tools">
                <EntryToolsGrid tools={topic.entry_tools} />
              </DetailSection>
            ) : null}

            {isLandingZone && defaultZone.services.length > 0 ? (
              <DetailSection title="Catalog scope">
                <p className="rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs text-muted-foreground">
                  <span className="font-mono font-bold text-foreground">
                    {defaultZone.services.length}
                  </span>{" "}
                  services across{" "}
                  <span className="font-mono font-bold text-foreground">
                    {defaultZone.locations.length}
                  </span>{" "}
                  regions and outposts
                  {totalZones > 1 ? ` (${totalZones} landing zones)` : ""}. Filter to this zone on
                  the availability map.
                </p>
              </DetailSection>
            ) : null}

            {/* Tier 2 — governance and the rest of the catalog around it. */}
            {hasGovernance ? (
              <DetailSection title="Guardrails & landing zones">
                <div className="grid gap-3 sm:grid-cols-2">
                  <GovernancePanel title="Guardrail areas" topics={guardrailAreas} />
                  <GovernancePanel title="Landing zones" topics={landingZones} />
                </div>
              </DetailSection>
            ) : null}

            {hasRelationships ? (
              <DetailSection title="Related catalog">
                <div className="grid gap-3 sm:grid-cols-2">
                  {relatedCapabilities.length > 0 ? (
                    <RelatedColumn title="Capabilities" topics={relatedCapabilities} />
                  ) : null}
                  {relatedLandingZones.length > 0 ? (
                    <RelatedColumn title="Landing zones" topics={relatedLandingZones} />
                  ) : null}
                  {relatedGuardrails.length > 0 ? (
                    <RelatedColumn title="Guardrail areas" topics={relatedGuardrails} />
                  ) : null}
                </div>
              </DetailSection>
            ) : null}

            {guidance.length > 0 ? (
              <DetailSection title="Related guidance">
                <RelatedGuidance items={guidance} />
              </DetailSection>
            ) : null}

            {/* Tier 3 — the trust layer: what backs every claim, and how fresh it is. */}
            <DetailSection title="Sources cited">
              {bundle ? (
                <div className="flex flex-col gap-3">
                  <FreshnessSummary bundle={bundle} updated={updated} />
                  <EvidenceSection bundle={bundle} />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card p-3.5 text-xs text-muted-foreground">
                  No registered sources resolved. Use feedback below to suggest one.
                </div>
              )}
            </DetailSection>

            <DetailSection title="Help Atlas stay accurate">
              <FeedbackInlineForm target={{ target_type: "topic", target_id: topic.id }} />
            </DetailSection>
          </>
        }
        side={
          <DetailMetaCard
            items={[
              { label: "Type", value: TYPE_LABEL[topic.topic_type] },
              { label: "Status", value: topic.status },
              { label: "Domain", value: topic.category },
              { label: "Owner", value: topic.owner_team },
              { label: "Support", value: topic.support_channel },
              ...(updated ? [{ label: "Updated", value: updated }] : []),
              { label: "ID", value: topic.id },
            ]}
            actions={
              <>
                {/* The page's single brand-primary action lives here. */}
                {primaryTool ? (
                  <a
                    href={primaryTool.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(
                      "inline-flex items-center justify-between gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors",
                      "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <span>{primaryTool.label}</span>
                    <IconArrowUpRight className="size-3.5" />
                  </a>
                ) : null}
                {topic.entry_tools.slice(1, 3).map((tool) => (
                  <a
                    key={tool.url}
                    href={tool.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(
                      "inline-flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors",
                      "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <IconLink className="size-3 text-muted-foreground" aria-hidden />
                      {tool.label}
                    </span>
                  </a>
                ))}
              </>
            }
          />
        }
      />
    </PageBody>
  );
}

function TrustSep() {
  return (
    <span aria-hidden className="text-border">
      ·
    </span>
  );
}

const STATUS_DOT: Record<Topic["status"], string> = {
  active: "bg-success",
  planned: "bg-info",
  deprecated: "bg-critical",
};

/**
 * Platform governance context for a capability: the guardrail areas and landing
 * zones registered in the catalog. Per-capability applicability is not yet a
 * first-class relationship in the topic model, so this lists the platform set;
 * confirm specific applicability with the owning team.
 */
function GovernancePanel({ title, topics }: { title: string; topics: ReadonlyArray<Topic> }) {
  if (topics.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-3">
        <p className="mb-2 font-mono type-caption font-bold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="type-caption text-muted-foreground">None registered.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 font-mono type-caption font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ul className="flex flex-col gap-0.5">
        {topics.map((topic) => (
          <li key={topic.id}>
            <Link
              to="/catalog/$topicId"
              params={{ topicId: topic.id }}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
            >
              <span
                aria-hidden
                className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[topic.status])}
              />
              <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
                {topic.name}
              </span>
              <span className="font-mono type-caption text-muted-foreground">{topic.category}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FreshnessSummary({
  bundle,
  updated,
}: {
  bundle: ContextBundleResponse;
  updated: string | null;
}) {
  const count = bundle.sources.length;
  const allAuthoritative =
    count > 0 && bundle.sources.every((entry) => entry.source.authority_level === "authoritative");
  const hasWarnings = bundle.warnings.length > 0;

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 type-caption text-muted-foreground">
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", hasWarnings ? "bg-warning" : "bg-success")}
      />
      <span>
        {count} {count === 1 ? "source" : "sources"} cited
      </span>
      <TrustSep />
      <span>{allAuthoritative ? "all authoritative" : "mixed authority"}</span>
      {updated ? (
        <>
          <TrustSep />
          <span>Updated {updated}</span>
        </>
      ) : null}
    </p>
  );
}

/** Most recent `last_observed_at` across the bundle's sources, as a YYYY-MM-DD label. */
function freshestObserved(bundle: ContextBundleResponse | null): string | null {
  if (!bundle || bundle.sources.length === 0) return null;
  let latest = "";
  for (const entry of bundle.sources) {
    if (entry.source.last_observed_at > latest) latest = entry.source.last_observed_at;
  }
  return latest ? latest.slice(0, 10) : null;
}

function StatusBadge({ status }: { status: Topic["status"] }) {
  const variant: React.ComponentProps<typeof Badge>["variant"] =
    status === "deprecated" ? "critical" : status === "planned" ? "info" : "success";
  return <Badge variant={variant}>{status}</Badge>;
}
