import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { IconArrowLeft, IconArrowUpRight, IconLink } from "@tabler/icons-react";
import type { ContextBundleResponse, Topic } from "@atlas/schema";

import { contextBundleQueryOptions, topicDiscoveryQueryOptions } from "@/api/queries";
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
import { FeedbackInlineForm } from "@/components/evidence/feedback-inline-form";
import { PageBody } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import { getGuardrailRules, type GuardrailRule } from "@/lib/guardrail-rules";
import { cn } from "@/lib/utils";

type LoaderData = {
  topic: Topic;
  bundle: ContextBundleResponse | null;
  relatedServices: ReadonlyArray<Topic>;
  relatedGuardrails: ReadonlyArray<Topic>;
  relatedLandingZones: ReadonlyArray<Topic>;
};

export const Route = createFileRoute("/guardrails/$guardrailId")({
  loader: async ({ context, params }): Promise<LoaderData> => {
    const topicsResp = await context.queryClient.ensureQueryData(topicDiscoveryQueryOptions);

    const topic = topicsResp.topics.find(
      (entry) => entry.id === params.guardrailId && entry.topic_type === "guardrail-area",
    );
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
      bundle,
      relatedServices: related.filter((entry) => entry.topic_type === "service"),
      relatedGuardrails: related.filter((entry) => entry.topic_type === "guardrail-area"),
      relatedLandingZones: related.filter((entry) => entry.topic_type === "landing-zone"),
    };
  },
  component: GuardrailDetailRoute,
});

function GuardrailDetailRoute() {
  const { topic, bundle, relatedServices, relatedGuardrails, relatedLandingZones } =
    Route.useLoaderData();

  const rules = getGuardrailRules(topic.id);
  const primaryTool = topic.entry_tools[0];
  const hasRelationships =
    relatedServices.length > 0 || relatedGuardrails.length > 0 || relatedLandingZones.length > 0;

  return (
    <PageBody width="comfortable" gap="compact">
      {/* Back link returns to the catalog's guardrails tab. */}
      <Link
        to="/catalog"
        search={{ tab: "guardrails" }}
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-sm text-xs font-medium text-muted-foreground transition-colors",
          "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <IconArrowLeft className="size-3.5" aria-hidden /> Back to guardrails
      </Link>

      <DetailHeader
        eyebrow={`Guardrail area · ${topic.category}`}
        title={topic.name}
        description={topic.description}
        badges={<StatusBadge status={topic.status} />}
      />

      <DetailLayout
        main={
          <>
            {topic.entry_tools.length > 0 ? (
              <DetailSection title="Entry tools">
                <EntryToolsGrid tools={topic.entry_tools} />
              </DetailSection>
            ) : null}

            {rules.length > 0 ? (
              <DetailSection
                title="Rules"
                description="What this guardrail enforces and how each rule is applied."
              >
                <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                  {rules.map((rule) => (
                    <RuleRow key={rule.id} rule={rule} />
                  ))}
                </ul>
              </DetailSection>
            ) : null}

            {hasRelationships ? (
              <DetailSection title="Related catalog">
                <div className="grid gap-3 sm:grid-cols-2">
                  {relatedServices.length > 0 ? (
                    <RelatedColumn title="Services" topics={relatedServices} />
                  ) : null}
                  {relatedGuardrails.length > 0 ? (
                    <RelatedColumn title="Guardrail areas" topics={relatedGuardrails} />
                  ) : null}
                  {relatedLandingZones.length > 0 ? (
                    <RelatedColumn title="Landing zones" topics={relatedLandingZones} />
                  ) : null}
                </div>
              </DetailSection>
            ) : null}

            <DetailSection title="Sources cited">
              {bundle ? (
                <EvidenceSection bundle={bundle} />
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
              { label: "Status", value: topic.status },
              { label: "Domain", value: topic.category },
              { label: "Owner", value: topic.owner_team },
              { label: "Support", value: topic.support_channel },
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

const SEVERITY_VARIANT: Record<GuardrailRule["severity"], React.ComponentProps<typeof Badge>["variant"]> =
  {
    critical: "critical",
    high: "warning",
    medium: "neutral",
  };

const STATUS_VARIANT: Record<GuardrailRule["status"], React.ComponentProps<typeof Badge>["variant"]> =
  {
    enforced: "success",
    monitor: "info",
    disabled: "neutral",
  };

const STATUS_LABEL: Record<GuardrailRule["status"], string> = {
  enforced: "Enforced",
  monitor: "Monitor",
  disabled: "Disabled",
};

function RuleRow({ rule }: { rule: GuardrailRule }) {
  return (
    <li className="flex flex-col gap-1.5 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <p className="text-sm font-semibold text-foreground">{rule.title}</p>
          <p className="truncate font-mono type-caption text-muted-foreground">{rule.id}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={SEVERITY_VARIANT[rule.severity]}>{rule.severity}</Badge>
          <Badge variant={STATUS_VARIANT[rule.status]}>
            <span aria-hidden className="size-[5px] rounded-full bg-current" />
            {STATUS_LABEL[rule.status]}
          </Badge>
        </div>
      </div>
      <p className="text-[13px] leading-[1.5] text-muted-foreground">{rule.description}</p>
    </li>
  );
}

function StatusBadge({ status }: { status: Topic["status"] }) {
  const variant: React.ComponentProps<typeof Badge>["variant"] =
    status === "deprecated" ? "critical" : status === "planned" ? "info" : "success";
  return <Badge variant={variant}>{status}</Badge>;
}
