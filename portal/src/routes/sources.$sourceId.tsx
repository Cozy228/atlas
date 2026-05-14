import { createFileRoute, notFound } from "@tanstack/react-router";
import { IconExternalLink } from "@tabler/icons-react";
import type { ContextBundleResponse, Source, SourceDiscoveryResponse } from "@atlas/schema";

import { contextBundleQueryOptions, sourceDiscoveryQueryOptions } from "@/api/queries";
import { ContextApiError } from "@/api/contextApiError";
import {
  BackLink,
  DetailHeader,
  DetailLayout,
  DetailMetaCard,
  DetailSection,
} from "@/components/detail/detail-shell";
import { EvidenceSection } from "@/components/detail/evidence-section";
import {
  AnchorStatusBadge,
  AuthorityBadge,
  FreshnessIndicator,
  SourceClassBadge,
  VisibilityBadge,
} from "@/components/evidence/badges";
import { FeedbackInlineForm } from "@/components/evidence/feedback-inline-form";
import { useRecordRecent } from "@/components/home/recently-viewed";
import { Badge } from "@/components/ui/badge";
import { PageBody } from "@/components/page-section";
import { cn } from "@/lib/utils";

type LoaderData = {
  source: Source;
  bundle: ContextBundleResponse | null;
};

export const Route = createFileRoute("/sources/$sourceId")({
  loader: async ({ context, params }): Promise<LoaderData> => {
    const sourcesResp: SourceDiscoveryResponse =
      await context.queryClient.ensureQueryData(sourceDiscoveryQueryOptions);
    const source = sourcesResp.sources.find((entry) => entry.id === params.sourceId);
    if (!source) {
      throw notFound();
    }

    let bundle: ContextBundleResponse | null = null;
    try {
      bundle = await context.queryClient.ensureQueryData(
        contextBundleQueryOptions({ source_id: source.id }),
      );
    } catch (error) {
      if (error instanceof ContextApiError) {
        bundle = null;
      } else {
        throw error;
      }
    }
    return { source, bundle };
  },
  component: SourceDetailRoute,
});

function SourceDetailRoute() {
  const { source, bundle } = Route.useLoaderData();

  useRecordRecent({ kind: "source", sourceId: source.id, name: source.title });

  const restricted = source.visibility === "restricted";

  return (
    <PageBody width="comfortable" gap="compact">
      <BackLink to="/sources" label="All sources" />

      <DetailHeader
        eyebrow={`Source · ${source.source_class}`}
        title={source.title}
        description={`Steward ${source.steward}. Scope: ${source.authority_scope.join(", ")}.`}
        badges={
          <>
            <AuthorityBadge level={source.authority_level} />
            <VisibilityBadge value={source.visibility} />
            <FreshnessIndicator source={source} />
            <Badge variant="outline" className="font-mono type-caption">
              {source.id}
            </Badge>
          </>
        }
        actions={
          !restricted ? (
            <a
              href={source.location}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors",
                "hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Open at source
              <IconExternalLink className="size-3.5" />
            </a>
          ) : null
        }
      />

      {restricted ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="type-detail font-bold text-warning-foreground">Restricted source</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Atlas surfaces metadata only. Direct fetches return{" "}
            <code className="rounded bg-card px-1 py-0.5 font-mono text-xs">access_denied</code>
            . Contact the steward for access.
          </p>
        </div>
      ) : null}

      <DetailLayout
        main={
          <>
            <DetailSection eyebrow="Anchors" title="Citations from this source">
              {bundle ? (
                bundle.sources.length === 0 && bundle.anchor_references.length > 0 ? (
                  <AnchorList bundle={bundle} />
                ) : (
                  <EvidenceSection bundle={bundle} defaultOpen />
                )
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-card p-3.5 text-xs text-muted-foreground">
                  The Context API returned no bundle for this source.
                </div>
              )}
            </DetailSection>

            <DetailSection eyebrow="Feedback" title="Help Atlas stay accurate">
              <FeedbackInlineForm target={{ target_type: "source", target_id: source.id }} />
            </DetailSection>
          </>
        }
        side={
          <DetailMetaCard
            items={[
              { label: "Class", value: source.source_class, mono: true },
              { label: "Steward", value: source.steward },
              { label: "Visibility", value: source.visibility, mono: true },
              {
                label: "Cadence",
                value: source.review_frequency,
                mono: true,
              },
              {
                label: "Reviewed",
                value: source.last_reviewed_at.slice(0, 10),
                mono: true,
              },
              {
                label: "Observed",
                value: source.last_observed_at.slice(0, 10),
                mono: true,
              },
              {
                label: "Scope",
                value: source.authority_scope.join(", "),
              },
              { label: "ID", value: source.id, mono: true },
            ]}
            actions={<SourceClassBadge value={source.source_class} />}
          />
        }
      />
    </PageBody>
  );
}

function AnchorList({ bundle }: { bundle: ContextBundleResponse }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {bundle.anchor_references.map((anchor) => (
        <li
          key={anchor.anchor_id}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
        >
          <span className="flex flex-col">
            <span className="font-mono text-xs text-muted-foreground">{anchor.anchor_id}</span>
            <span className="text-xs font-semibold text-foreground">
              {anchor.citation_label}
            </span>
          </span>
          <AnchorStatusBadge status={anchor.status} />
        </li>
      ))}
    </ul>
  );
}
