import { createFileRoute, notFound } from "@tanstack/react-router";
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
  availability: AvailabilityResponse;
  bundle: ContextBundleResponse | null;
};

export const Route = createFileRoute("/landing-zones/$topicId")({
  loader: async ({ params }): Promise<LoaderData> => {
    const [topicsResp, availability]: [
      TopicDiscoveryResponse,
      AvailabilityResponse,
    ] = await Promise.all([fetchTopicDiscovery(), fetchAvailability()]);

    const topic = topicsResp.topics.find((entry) => entry.id === params.topicId);
    if (!topic || topic.topic_type !== "landing-zone") {
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
        entry.topic_type !== "landing-zone" && entry.category === topic.category,
    );

    return { topic, related, availability, bundle };
  },
  component: LandingZoneDetailRoute,
});

function LandingZoneDetailRoute() {
  const { topic, related, availability, bundle } = Route.useLoaderData();

  useRecordRecent({ kind: "landing-zone", topicId: topic.id, name: topic.name });

  const guardrails = related.filter((entry) => entry.topic_type === "guardrail-area");
  const capabilities = related.filter((entry) => entry.topic_type === "capability");

  return (
    <PageBody width="comfortable">
      <BackLink to="/landing-zones" label="All landing zones" />

      <DetailHeader
        eyebrow={`Landing zone · ${topic.category}`}
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
      />

      <DetailSection
        eyebrow="Comparison"
        title="Environment summary"
        description="Lift this row into the comparison matrix on the landing zones index. Use the entry tools below to provision."
      >
        <ComparisonRow topic={topic} />
      </DetailSection>

      <DetailSection
        eyebrow="Get started"
        title="Provisioning entry"
        description="Registered Terraform modules, Harness pipelines, and onboarding paths."
      >
        <EntryToolsGrid tools={topic.entry_tools} />
      </DetailSection>

      {availability.services.length > 0 ? (
        <DetailSection
          eyebrow="Capabilities"
          title="Services typically deployed here"
          description="Snapshot from the availability projection. Use the availability map for region-level context."
        >
          <ServicesPreview locations={availability.locations.length} services={availability.services.length} />
        </DetailSection>
      ) : null}

      {capabilities.length > 0 || guardrails.length > 0 ? (
        <DetailSection
          eyebrow="Relationships"
          title="Connected catalog objects"
          description="Capabilities and guardrails registered against the same domain."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {capabilities.length > 0 ? (
              <RelatedColumn
                title="Capabilities"
                description="Approved services frequently deployed in this zone."
                topics={capabilities}
              />
            ) : null}
            {guardrails.length > 0 ? (
              <RelatedColumn
                title="Guardrail areas"
                description="Controls that apply to workloads in this zone."
                topics={guardrails}
              />
            ) : null}
          </div>
        </DetailSection>
      ) : null}

      <DetailSection
        eyebrow="Evidence"
        title="Sources cited for this landing zone"
        description="Guardrail and provisioning evidence with anchors, freshness, and warnings."
      >
        {bundle ? (
          <EvidenceSection bundle={bundle} />
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-4 text-[13px] text-muted-foreground">
            No registered sources resolved for this landing zone.
          </div>
        )}
      </DetailSection>

      <DetailSection eyebrow="Feedback" title="Help Atlas stay accurate">
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

function ComparisonRow({ topic }: { topic: Topic }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-4">
      <Cell label="Domain" value={topic.category} />
      <Cell label="Status" value={topic.status} />
      <Cell label="Owner" value={topic.owner_team} mono />
      <Cell label="Support" value={topic.support_channel} mono />
    </dl>
  );
}

function Cell({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-card px-3 py-2.5">
      <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-[13px] font-semibold text-foreground",
          mono && "font-mono text-[12px]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ServicesPreview({
  services,
  locations,
}: {
  services: number;
  locations: number;
}) {
  return (
    <p className="rounded-lg border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground">
      <span className="font-mono font-bold text-foreground">{services}</span>{" "}
      services registered across{" "}
      <span className="font-mono font-bold text-foreground">{locations}</span>{" "}
      regions and outposts. Filter to a specific landing zone level on the
      availability map for precise placement context.
    </p>
  );
}

function RelatedColumn({
  title,
  description,
  topics,
}: {
  title: string;
  description: string;
  topics: ReadonlyArray<Topic>;
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
                topic.topic_type === "capability"
                  ? `/capabilities/${topic.id}`
                  : `/landing-zones/${topic.id}`
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
