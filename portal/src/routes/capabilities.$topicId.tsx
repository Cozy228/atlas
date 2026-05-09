import { createFileRoute, notFound } from "@tanstack/react-router";
import { IconArrowUpRight } from "@tabler/icons-react";
import type {
  ContextBundleResponse,
  Topic,
  TopicDiscoveryResponse,
} from "@atlas/schema";

import {
  fetchAvailability,
  type AvailabilityResponse,
} from "@/api/server/availability";
import {
  fetchContextBundle,
  fetchTopicDiscovery,
} from "@/api/server/contextApi";
import { ContextApiError } from "@/api/contextApiError";
import { AvailabilityStrip } from "@/components/detail/availability-strip";
import { BackLink, DetailHeader, DetailSection } from "@/components/detail/detail-shell";
import { EntryToolsGrid } from "@/components/detail/entry-tools-grid";
import { EvidenceSection } from "@/components/detail/evidence-section";
import { OwnerRow } from "@/components/detail/owner-row";
import { FeedbackInlineForm } from "@/components/evidence/feedback-inline-form";
import { useRecordRecent } from "@/components/home/recently-viewed";
import { Badge } from "@/components/ui/badge";
import { PageBody } from "@/components/page-section";
import { cn } from "@/lib/utils";

type LoaderData = {
  topic: Topic;
  related: ReadonlyArray<Topic>;
  bundle: ContextBundleResponse | null;
  availability: AvailabilityResponse;
};

export const Route = createFileRoute("/capabilities/$topicId")({
  loader: async ({ params }): Promise<LoaderData> => {
    const [topicsResp, availability]: [
      TopicDiscoveryResponse,
      AvailabilityResponse,
    ] = await Promise.all([fetchTopicDiscovery(), fetchAvailability()]);

    const topic = topicsResp.topics.find((entry) => entry.id === params.topicId);
    if (!topic || topic.topic_type !== "capability") {
      throw notFound();
    }

    let bundle: ContextBundleResponse | null = null;
    try {
      bundle = await fetchContextBundle({ data: { topic_id: topic.id } });
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
      (entry) =>
        entry.topic_type !== "capability" && entry.category === topic.category,
    );

    return { topic, related, bundle, availability };
  },
  component: CapabilityDetailRoute,
});

function CapabilityDetailRoute() {
  const { topic, related, bundle, availability } = Route.useLoaderData();

  useRecordRecent({ kind: "capability", topicId: topic.id, name: topic.name });

  const service =
    availability.services.find((entry) => entry.id === topic.id) ?? null;
  const guardrails = related.filter(
    (entry) => entry.topic_type === "guardrail-area",
  );
  const landingZones = related.filter(
    (entry) => entry.topic_type === "landing-zone",
  );

  return (
    <PageBody width="comfortable">
      <BackLink to="/capabilities" label="All capabilities" />

      <DetailHeader
        eyebrow={`Capability · ${topic.category}`}
        title={topic.name}
        description={topic.description}
        badges={
          <>
            <StatusBadge status={topic.status} />
            <Badge variant="outline" className="font-mono text-[10px]">
              {topic.id}
            </Badge>
          </>
        }
        meta={<OwnerRow team={topic.owner_team} channel={topic.support_channel} />}
        actions={
          topic.entry_tools[0] ? (
            <a
              href={topic.entry_tools[0].url}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-colors",
                "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              {topic.entry_tools[0].label}
              <IconArrowUpRight className="size-3.5" />
            </a>
          ) : null
        }
      />

      <DetailSection
        eyebrow="Decision"
        title="When to use this capability"
        description="The summary below is sourced from the registered topic description. Authoritative when-to-use guidance lives on the source surfaces below."
      >
        <p className="max-w-[68ch] text-[14px] leading-[1.7] text-foreground">
          {topic.description}
        </p>
      </DetailSection>

      <DetailSection
        eyebrow="Get started"
        title="Entry tools"
        description="Open the registered Terraform module, Harness pipeline, or onboarding form."
      >
        <EntryToolsGrid tools={topic.entry_tools} />
      </DetailSection>

      <DetailSection
        eyebrow="Availability"
        title="Where this is available"
        description="Status across STT regions and outposts. Open the availability map for full context and next-step actions."
      >
        <AvailabilityStrip service={service} locations={availability.locations} />
      </DetailSection>

      {landingZones.length > 0 || guardrails.length > 0 ? (
        <DetailSection
          eyebrow="Relationships"
          title="Connected catalog objects"
          description="Landing zones and guardrail areas registered against the same domain."
        >
          <RelationshipPanel
            landingZones={landingZones}
            guardrails={guardrails}
          />
        </DetailSection>
      ) : null}

      <DetailSection
        eyebrow="Evidence"
        title="Sources cited for this capability"
        description="Authority, visibility, freshness, anchors, and excerpts expand inline. Restricted sources are visible as metadata only."
      >
        {bundle ? (
          <EvidenceSection bundle={bundle} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-4 text-[13px] text-muted-foreground">
            No registered sources resolved for this topic. Use the feedback
            below to suggest one.
          </div>
        )}
      </DetailSection>

      <DetailSection
        eyebrow="Feedback"
        title="Help Atlas stay accurate"
        description="Reports route to the topic steward. Atlas does not edit source content."
      >
        <FeedbackInlineForm
          target={{ target_type: "topic", target_id: topic.id }}
        />
      </DetailSection>
    </PageBody>
  );
}

function StatusBadge({ status }: { status: Topic["status"] }) {
  const variant: React.ComponentProps<typeof Badge>["variant"] =
    status === "deprecated"
      ? "critical"
      : status === "planned"
        ? "warning"
        : "success";
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
        <RelatedColumn
          title="Landing zones"
          description="Environments registered in the same domain."
          topics={landingZones}
          basePath="/landing-zones/$topicId"
        />
      ) : null}
      {guardrails.length > 0 ? (
        <RelatedColumn
          title="Guardrail areas"
          description="Policy and control areas that govern this domain."
          topics={guardrails}
          basePath="/capabilities/$topicId"
        />
      ) : null}
    </div>
  );
}

function RelatedColumn({
  title,
  description,
  topics,
  basePath,
}: {
  title: string;
  description: string;
  topics: ReadonlyArray<Topic>;
  basePath: "/landing-zones/$topicId" | "/capabilities/$topicId";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[13px] font-bold text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground">{description}</p>
      <ul className="mt-3 flex flex-col gap-1">
        {topics.map((topic) => (
          <li key={topic.id}>
            <a
              href={
                basePath === "/landing-zones/$topicId"
                  ? `/landing-zones/${topic.id}`
                  : `/capabilities/${topic.id}`
              }
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors",
                "hover:bg-muted",
              )}
            >
              <span className="text-[12px] font-semibold text-foreground">
                {topic.name}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {topic.owner_team}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
