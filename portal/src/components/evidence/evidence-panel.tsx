import { IconExternalLink, IconUsers } from "@tabler/icons-react";

import {
  AnchorStatusBadge,
  AuthorityBadge,
  FreshnessIndicator,
  SourceClassBadge,
  VisibilityBadge,
} from "@/components/evidence/badges";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  ContextBundleResponse,
  ContextBundleSource,
  ExpansionPath,
} from "@atlas/schema";

type EvidencePanelProps = {
  bundle: ContextBundleResponse;
  className?: string;
};

/**
 * EvidencePanel renders the source identity, authority badges, anchors and
 * cited excerpts for a context bundle. It is intentionally split into a
 * dense list, not nested cards, so the source rail in the design plan can
 * compose this directly without wrapping everything in another container.
 */
export function EvidencePanel({ bundle, className }: EvidencePanelProps) {
  if (bundle.sources.length === 0) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground",
          className,
        )}
      >
        No registered sources for this topic. Submit feedback to suggest one.
      </div>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {bundle.sources.map((entry) => (
        <li
          key={entry.source.id}
          className="flex flex-col gap-3 rounded-md border border-border bg-card p-4"
        >
          <SourceHeader entry={entry} />
          <RationaleAndExcerpts entry={entry} />
          <ExpansionPathList
            paths={bundle.expansion_paths.filter(
              (path) => path.source_id === entry.source.id,
            )}
          />
        </li>
      ))}
    </ul>
  );
}

function SourceHeader({ entry }: { entry: ContextBundleSource }) {
  const { source } = entry;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold leading-6 text-foreground">
          {source.title}
        </h3>
        <AuthorityBadge level={source.authority_level} />
        <VisibilityBadge value={source.visibility} />
        <FreshnessIndicator source={source} />
        <SourceClassBadge value={source.source_class} />
      </div>
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <IconUsers className="size-3.5" aria-hidden />
        <span>steward · {source.steward}</span>
        <span>·</span>
        <span>scope · {source.authority_scope.join(", ")}</span>
        <span>·</span>
        <span>
          reviewed{" "}
          <time dateTime={source.last_reviewed_at}>
            {source.last_reviewed_at.slice(0, 10)}
          </time>
          {" "}every {source.review_frequency}
        </span>
      </p>
    </div>
  );
}

function RationaleAndExcerpts({ entry }: { entry: ContextBundleSource }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-6 text-muted-foreground">
        {entry.selection_rationale}
      </p>
      {entry.excerpts.length > 0 ? (
        <div className="flex flex-col gap-3 border-l-0 border-t border-border pt-3">
          {entry.excerpts.map((excerpt, index) => (
            <figure
              key={`${excerpt.citation.source_id}-${excerpt.citation.anchor_id ?? index}`}
              className="flex flex-col gap-2"
            >
              <blockquote className="text-sm leading-6 text-foreground">
                “{excerpt.text}”
              </blockquote>
              <figcaption className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">cite</Badge>
                <span className="font-mono text-[11px]">
                  {excerpt.citation.label}
                </span>
                <a
                  className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                  href={excerpt.citation.location}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  open source
                  <IconExternalLink className="size-3" aria-hidden />
                </a>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {entry.anchors.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {entry.anchors.map((anchor) => (
            <li
              key={anchor.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground"
            >
              <span className="font-mono">{anchor.id}</span>
              <AnchorStatusBadge status={anchor.status} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ExpansionPathList({
  paths,
}: {
  paths: ReadonlyArray<ExpansionPath>;
}) {
  if (paths.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        Expansion paths
      </p>
      <ul className="flex flex-wrap gap-2">
        {paths.map((path, index) => (
          <li
            key={`${path.source_id}-${path.anchor_id ?? index}`}
            className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs"
          >
            <span className="font-mono text-muted-foreground">
              level {path.disclosure_level}
            </span>
            <span className="text-foreground">{path.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
