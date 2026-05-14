import { createFileRoute, notFound } from "@tanstack/react-router";
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
import { ServiceIcon } from "@/components/explore/service-icon";
import { useRecordRecent } from "@/components/home/recently-viewed";
import { Badge } from "@/components/ui/badge";
import { PageBody } from "@/components/page-section";
import { findAvailabilityServiceForTopic } from "@/lib/capability-service";
import { cn } from "@/lib/utils";

type LoaderData = {
  topic: Topic;
  related: ReadonlyArray<Topic>;
  bundle: ContextBundleResponse | null;
  defaultZone: LandingZoneData;
};

export const Route = createFileRoute("/capabilities/$topicId")({
  loader: async ({ context, params }): Promise<LoaderData> => {
    const [topicsResp, availability]: [TopicDiscoveryResponse, AvailabilityResponse] =
      await Promise.all([
        context.queryClient.ensureQueryData(topicDiscoveryQueryOptions),
        context.queryClient.ensureQueryData(availabilityQueryOptions),
      ]);

    const topic = topicsResp.topics.find((entry) => entry.id === params.topicId);
    if (!topic || topic.topic_type !== "capability") {
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
      (entry) => entry.topic_type !== "capability" && entry.category === topic.category,
    );

    return { topic, related, bundle, defaultZone: availability.zones[0]! };
  },
  component: CapabilityDetailRoute,
});

function CapabilityDetailRoute() {
  const { topic, related, bundle, defaultZone } = Route.useLoaderData();

  useRecordRecent({ kind: "capability", topicId: topic.id, name: topic.name });

  const service = findAvailabilityServiceForTopic(topic, defaultZone.services);
  const guardrails = related.filter((entry) => entry.topic_type === "guardrail-area");
  const landingZones = related.filter((entry) => entry.topic_type === "landing-zone");
  const primaryTool = topic.entry_tools[0];

  return (
    <PageBody width="comfortable" gap="compact">
      <BackLink to="/capabilities" label="All capabilities" />

      <DetailHeader
        eyebrow={`Capability · ${topic.category}`}
        title={topic.name}
        description={topic.description}
        leading={service ? <ServiceIcon serviceId={service.id} size="hero" /> : undefined}
        badges={
          <>
            <StatusBadge status={topic.status} />
            <Badge variant="outline" className="font-mono type-caption">
              {topic.id}
            </Badge>
          </>
        }
        actions={
          primaryTool ? (
            <a
              href={primaryTool.url}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors",
                "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {primaryTool.label}
              <IconArrowUpRight className="size-3.5" />
            </a>
          ) : null
        }
      />

      <DetailLayout
        main={
          <>
            <DetailSection eyebrow="Get started" title="Entry tools">
              <EntryToolsGrid tools={topic.entry_tools} />
            </DetailSection>

            <DetailSection eyebrow="Availability" title="Where this is available">
              <AvailabilityStrip service={service} locations={defaultZone.locations} />
            </DetailSection>

            {landingZones.length > 0 || guardrails.length > 0 ? (
              <DetailSection eyebrow="Relationships" title="Related catalog">
                <RelationshipPanel landingZones={landingZones} guardrails={guardrails} />
              </DetailSection>
            ) : null}

            <DetailSection eyebrow="Evidence" title="Sources cited">
              {bundle ? (
                <EvidenceSection bundle={bundle} />
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card p-3.5 text-xs text-muted-foreground">
                  No registered sources resolved. Use feedback below to suggest one.
                </div>
              )}
            </DetailSection>

            <DetailSection eyebrow="Feedback" title="Help Atlas stay accurate">
              <FeedbackInlineForm target={{ target_type: "topic", target_id: topic.id }} />
            </DetailSection>
          </>
        }
        side={
          <DetailMetaCard
            items={[
              { label: "Status", value: topic.status, mono: true },
              { label: "Domain", value: topic.category },
              { label: "Owner", value: topic.owner_team },
              { label: "Support", value: topic.support_channel, mono: true },
              { label: "ID", value: topic.id, mono: true },
            ]}
            actions={
              <>
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

function StatusBadge({ status }: { status: Topic["status"] }) {
  const variant: React.ComponentProps<typeof Badge>["variant"] =
    status === "deprecated" ? "critical" : status === "planned" ? "warning" : "success";
  return <Badge variant={variant}>{status}</Badge>;
}

function RelationshipPanel({
  landingZones,
  guardrails,
}: {
  landingZones: ReadonlyArray<Topic>;
  guardrails: ReadonlyArray<Topic>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {landingZones.length > 0 ? (
        <RelatedColumn title="Landing zones" topics={landingZones} kind="landing-zone" />
      ) : null}
      {guardrails.length > 0 ? (
        <RelatedColumn title="Guardrail areas" topics={guardrails} kind="capability" />
      ) : null}
    </div>
  );
}

