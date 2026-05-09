import { createFileRoute, notFound } from "@tanstack/react-router";
import { IconExternalLink } from "@tabler/icons-react";
import type {
  ContextBundleResponse,
  Source,
  SourceDiscoveryResponse,
} from "@atlas/schema";

import {
  fetchContextBundle,
  fetchSourceDiscovery,
} from "@/api/server/contextApi";
import { ContextApiError } from "@/api/contextApiError";
import { BackLink, DetailHeader, DetailSection } from "@/components/detail/detail-shell";
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
  loader: async ({ params }): Promise<LoaderData> => {
    const sourcesResp: SourceDiscoveryResponse = await fetchSourceDiscovery();
    const source = sourcesResp.sources.find((entry) => entry.id === params.sourceId);
    if (!source) {
      throw notFound();
    }

    let bundle: ContextBundleResponse | null = null;
    try {
      bundle = await fetchContextBundle({ data: { source_id: source.id } });
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
    <PageBody width="comfortable">
      <BackLink to="/sources" label="All sources" />

      <DetailHeader
        eyebrow={`Source · ${source.source_class}`}
        title={source.title}
        description={`Steward ${source.steward}. Authority scope: ${source.authority_scope.join(", ")}.`}
        badges={
          <>
            <AuthorityBadge level={source.authority_level} />
            <VisibilityBadge value={source.visibility} />
            <FreshnessIndicator source={source} />
            <SourceClassBadge value={source.source_class} />
            <Badge variant="outline" className="font-mono text-[10px]">
              {source.id}
            </Badge>
          </>
        }
        meta={
          <span className="font-mono">
            reviewed{" "}
            <time dateTime={source.last_reviewed_at}>
              {source.last_reviewed_at.slice(0, 10)}
            </time>{" "}
            · cadence {source.review_frequency} · observed{" "}
            <time dateTime={source.last_observed_at}>
              {source.last_observed_at.slice(0, 10)}
            </time>
          </span>
        }
        actions={
          !restricted ? (
            <a
              href={source.location}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-[12px] font-semibold text-foreground transition-colors",
                "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              Open at source
              <IconExternalLink className="size-3.5" />
            </a>
          ) : null
        }
      />

      {restricted ? (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <p className="text-[13px] font-bold text-warning-foreground">
            Restricted source
          </p>
          <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
            Atlas surfaces metadata only. Direct fetches return{" "}
            <code className="rounded bg-card px-1 py-0.5 font-mono text-[11px]">
              access_denied
            </code>
            . Contact the steward for access.
          </p>
        </div>
      ) : null}

      <DetailSection
        eyebrow="Identity"
        title="Source location and stewardship"
        description="The full evidence header lives below; this card pins the canonical source identity."
      >
        <SourceIdentityCard source={source} />
      </DetailSection>

      {bundle ? (
        <DetailSection
          eyebrow="Anchors and warnings"
          title="Citations cited from this source"
          description="Anchors expand inline. Broken or weak anchors are marked so consumers can route around them."
        >
          {bundle.sources.length === 0 && bundle.anchor_references.length > 0 ? (
            <AnchorList bundle={bundle} />
          ) : (
            <EvidenceSection bundle={bundle} defaultOpen />
          )}
        </DetailSection>
      ) : (
        <DetailSection
          eyebrow="Anchors and warnings"
          title="Evidence bundle unavailable"
        >
          <div className="rounded-lg border border-dashed border-border bg-card p-4 text-[13px] text-muted-foreground">
            The Context API returned no bundle for this source. Anchors are
            shown without excerpts.
          </div>
        </DetailSection>
      )}

      <DetailSection eyebrow="Feedback" title="Help Atlas stay accurate">
        <FeedbackInlineForm
          target={{ target_type: "source", target_id: source.id }}
        />
      </DetailSection>
    </PageBody>
  );
}

function SourceIdentityCard({ source }: { source: Source }) {
  return (
    <dl className="grid gap-px overflow-hidden rounded-lg bg-border sm:grid-cols-2">
      <Cell label="Steward" value={source.steward} />
      <Cell label="Class" value={source.source_class} mono />
      <Cell label="Authority scope" value={source.authority_scope.join(", ")} />
      <Cell label="Visibility" value={source.visibility} mono />
      <Cell label="Review cadence" value={source.review_frequency} mono />
      <Cell
        label="Location"
        value={source.location}
        mono
        truncate
      />
    </dl>
  );
}

function Cell({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-card px-3 py-2.5">
      <dt className="font-mono text-[10px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-[13px] text-foreground",
          mono && "font-mono text-[12px]",
          truncate && "truncate",
        )}
        title={truncate ? value : undefined}
      >
        {value}
      </dd>
    </div>
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
            <span className="font-mono text-[11px] text-muted-foreground">
              {anchor.anchor_id}
            </span>
            <span className="text-[12px] font-semibold text-foreground">
              {anchor.citation_label}
            </span>
          </span>
          <AnchorStatusBadge status={anchor.status} />
        </li>
      ))}
    </ul>
  );
}
