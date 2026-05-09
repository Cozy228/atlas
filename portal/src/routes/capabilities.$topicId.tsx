import { createFileRoute, notFound } from "@tanstack/react-router";
import { IconArrowUpRight, IconLink } from "@tabler/icons-react";
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
import {
  BackLink,
  DetailHeader,
  DetailLayout,
  DetailMetaCard,
  DetailSection,
} from "@/components/detail/detail-shell";
import { EntryToolsGrid } from "@/components/detail/entry-tools-grid";
import { EvidenceSection } from "@/components/detail/evidence-section";
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
  const primaryTool = topic.entry_tools[0];

  return (
    <PageBody width="comfortable" gap="compact">
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
        actions={
          primaryTool ? (
            <a
              href={primaryTool.url}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-colors",
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
              <AvailabilityStrip
                service={service}
                locations={availability.locations}
              />
            </DetailSection>

            {landingZones.length > 0 || guardrails.length > 0 ? (
              <DetailSection eyebrow="Relationships" title="Related catalog">
                <RelationshipPanel
                  landingZones={landingZones}
                  guardrails={guardrails}
                />
              </DetailSection>
            ) : null}

            <DetailSection eyebrow="Evidence" title="Sources cited">
              {bundle ? (
                <EvidenceSection bundle={bundle} />
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card p-3.5 text-[12px] text-muted-foreground">
                  No registered sources resolved. Use feedback below to suggest one.
                </div>
              )}
            </DetailSection>

            <DetailSection eyebrow="Feedback" title="Help Atlas stay accurate">
              <FeedbackInlineForm
                target={{ target_type: "topic", target_id: topic.id }}
              />
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
                      "inline-flex items-center justify-between gap-2 rounded-md bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-colors",
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
                      "inline-flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors",
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
        <RelatedColumn title="Landing zones" topics={landingZones} kind="landing-zone" />
      ) : null}
      {guardrails.length > 0 ? (
        <RelatedColumn title="Guardrail areas" topics={guardrails} kind="capability" />
      ) : null}
    </div>
  );
}

function RelatedColumn({
  title,
  topics,
  kind,
}: {
  title: string;
  topics: ReadonlyArray<Topic>;
  kind: "landing-zone" | "capability";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.05em] text-muted-foreground">
        {title}
      </p>
      <ul className="flex flex-col gap-0.5">
        {topics.map((topic) => (
          <li key={topic.id}>
            <a
              href={
                kind === "landing-zone"
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
