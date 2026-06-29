import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { IconArrowLeft, IconArrowUpRight, IconLink } from "@tabler/icons-react";
import type { ResourceContextResponse, Topic } from "@atlas/schema";

import { resourceContextQueryOptions, topicDiscoveryQueryOptions } from "@/api/queries";
import { ContextApiError } from "@/api/contextApiError";
import {
  DetailHeader,
  DetailLayout,
  DetailMetaCard,
  DetailSection,
} from "@/components/detail/detail-shell";
import { EntryToolsGrid } from "@/components/detail/entry-tools-grid";
import { EvidenceSection } from "@/components/detail/evidence-section";
import { RelatedColumn } from "@/components/detail/related-column";
import { DeferredRegion } from "@/components/deferred-region";
import { DataNotAvailableForZone } from "@/components/landing-zone/data-not-available";
import { useCurrentLandingZoneRecord } from "@/components/landing-zone/landing-zone-gate";
import { FeedbackInlineForm } from "@/components/evidence/feedback-inline-form";
import { PageBody } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type LoaderData = {
  topic: Topic;
  projection: Promise<ResourceContextResponse | null>;
  relatedServices: ReadonlyArray<Topic>;
  relatedPolicies: ReadonlyArray<Topic>;
};

export const Route = createFileRoute("/policies/$policyId")({
  loader: async ({ context, params }): Promise<LoaderData> => {
    const topicsResp = await context.queryClient.ensureQueryData(topicDiscoveryQueryOptions);

    const topic = topicsResp.topics.find(
      (entry) => entry.id === params.policyId && entry.topic_type === "security-policy",
    );
    if (!topic) {
      throw notFound();
    }

    // Policy = a discovered Resource (plan 019): a security policy's governed
    // documents are a guardrail Resource's Sections, live-resolved + cited. The
    // guardrail answers to the policy topic id through its aliases; an
    // unconfigured policy resolves to no Resource and renders an honest gap.
    // Slow live resolve — defer it so navigation is instant and the "Policy
    // documents" block renders a skeleton until it lands.
    const projection = context.queryClient
      .ensureQueryData(resourceContextQueryOptions({ kind: "guardrail", slug: topic.id }))
      .catch((error: unknown): ResourceContextResponse | null => {
        if (error instanceof ContextApiError && error.code === "resource_not_found") {
          return null;
        }
        throw error;
      });

    const related = topicsResp.topics.filter(
      (entry) => entry.id !== topic.id && entry.category === topic.category,
    );

    return {
      topic,
      projection,
      relatedServices: related.filter((entry) => entry.topic_type === "service"),
      relatedPolicies: related.filter((entry) => entry.topic_type === "security-policy"),
    };
  },
  component: PolicyDetailRoute,
});

function PolicyDetailRoute() {
  const { topic, projection, relatedServices, relatedPolicies } = Route.useLoaderData();
  const landingZone = useCurrentLandingZoneRecord();

  const entryTools = topic.entry_tools ?? [];
  const primaryTool = entryTools[0];
  const hasRelationships = relatedServices.length > 0 || relatedPolicies.length > 0;

  // Per-LZ honesty (plan 021 C2, ADR-0006): an unwired landing zone shows the
  // honest dead-end here too, never the default zone's policy.
  if (landingZone?.dataStatus === "not-available") {
    return (
      <PageBody width="comfortable" gap="compact">
        <Link
          to="/catalog"
          search={{ tab: "policies" }}
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground transition-colors",
            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <IconArrowLeft className="size-3.5" aria-hidden /> Back to security policies
        </Link>
        <DataNotAvailableForZone zoneName={landingZone.name} surface="policy" />
      </PageBody>
    );
  }

  return (
    <PageBody width="comfortable" gap="compact">
      {/* Back link returns to the catalog's security-policies tab. */}
      <Link
        to="/catalog"
        search={{ tab: "policies" }}
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground transition-colors",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <IconArrowLeft className="size-3.5" aria-hidden /> Back to security policies
      </Link>

      <DetailHeader
        eyebrow={`Security policy · ${topic.category}`}
        title={topic.name}
        description={topic.description}
        badges={<StatusBadge status={topic.status} />}
      />

      <DetailLayout
        main={
          <>
            {entryTools.length > 0 ? (
              <DetailSection title="Entry tools">
                <EntryToolsGrid tools={entryTools} />
              </DetailSection>
            ) : null}

            {hasRelationships ? (
              <DetailSection title="Related catalog">
                <div className="grid gap-3 sm:grid-cols-2">
                  {relatedServices.length > 0 ? (
                    <RelatedColumn title="Services" topics={relatedServices} />
                  ) : null}
                  {relatedPolicies.length > 0 ? (
                    <RelatedColumn title="Security policies" topics={relatedPolicies} />
                  ) : null}
                </div>
              </DetailSection>
            ) : null}

            {/* The authoritative content of a security policy is its registered
             * policy document(s), resolved live and cited here — no parallel
             * hand-maintained rule list to drift from the source of record. */}
            <DetailSection title="Policy documents">
              <DeferredRegion
                promise={projection}
                fallback={<EvidenceSkeleton />}
                label="the policy documents"
                retry
              >
                {(resolved) =>
                  resolved ? (
                    <EvidenceSection projection={resolved} />
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-card p-3.5 text-xs text-muted-foreground">
                      No governed policy documents are configured for this policy yet. Use feedback
                      below to suggest a source.
                    </div>
                  )
                }
              </DeferredRegion>
            </DetailSection>

            <DetailSection title="Help Atlas stay accurate">
              <FeedbackInlineForm target={{ target_type: "topic", target_id: topic.id }} />
            </DetailSection>
          </>
        }
        side={
          <DeferredRegion promise={projection} fallback={<MetaCardSkeleton />} label="the details">
            {() => (
              <DetailMetaCard
                items={[
                  { label: "Status", value: topic.status },
                  { label: "Domain", value: topic.category },
                  { label: "Owner", value: topic.owner_team ?? "—" },
                  { label: "Support", value: topic.support_channel ?? "—" },
                  { label: "ID", value: topic.id },
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
                    {entryTools.slice(1, 3).map((tool) => (
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
            )}
          </DeferredRegion>
        }
      />
    </PageBody>
  );
}

function StatusBadge({ status }: { status: Topic["status"] }) {
  const variant: React.ComponentProps<typeof Badge>["variant"] =
    status === "deprecated" ? "critical" : status === "planned" ? "info" : "success";
  return <Badge variant={variant}>{status}</Badge>;
}

/** Placeholder for the deferred "Policy documents" block — mirrors the collapsed
 * EvidenceSection trigger card so the layout doesn't shift when the bundle lands. */
function EvidenceSkeleton() {
  return (
    <div
      aria-hidden
      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
    >
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-56" />
      </div>
      <Skeleton className="size-7 rounded-md" />
    </div>
  );
}

/** Placeholder for the deferred meta card (status, domain, owner, support, id). */
function MetaCardSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-col divide-y divide-border">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
