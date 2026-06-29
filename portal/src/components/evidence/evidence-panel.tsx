import { IconExternalLink } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContextSection, ResourceContextResponse } from "@atlas/schema";

type EvidencePanelProps = {
  projection: ResourceContextResponse;
  className?: string;
};

const SECTION_STATUS_VARIANT: Record<
  ContextSection["status"],
  React.ComponentProps<typeof Badge>["variant"]
> = {
  available: "success",
  partial: "warning",
  unresolved: "neutral",
};

/** Humanize a Section id ("enforced-controls" -> "Enforced controls"). */
function sectionLabel(id: string): string {
  const spaced = id.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * EvidencePanel renders a resource projection (ADR-0013) as a dense list of
 * Sections: each Section's live-resolved content and its citations. It is
 * intentionally a flat list, not nested cards, so a detail surface can compose
 * it directly. Missing Sections (no registered source) render as honest gaps.
 */
export function EvidencePanel({ projection, className }: EvidencePanelProps) {
  const requested =
    projection.requestedSections.length > 0
      ? projection.requestedSections
      : Object.keys(projection.sections);
  const present = requested.filter((id) => projection.sections[id]);

  if (present.length === 0 && projection.missingSections.length === 0) {
    return (
      <div
        className={cn(
          "rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground",
          className,
        )}
      >
        {projection.governance === "unconfigured"
          ? "No governed sources are configured for this resource yet."
          : "No sections resolved for this resource. Submit feedback to suggest a source."}
      </div>
    );
  }

  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {present.map((id) => (
        <SectionItem key={id} id={id} section={projection.sections[id]!} />
      ))}
      {projection.missingSections.map((missing) => (
        <li
          key={missing.section}
          className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-card p-4 text-sm text-muted-foreground"
        >
          <span className="font-semibold text-foreground">{sectionLabel(missing.section)}</span>
          {missing.message}
        </li>
      ))}
    </ul>
  );
}

function SectionItem({ id, section }: { id: string; section: ContextSection }) {
  return (
    <li className="flex flex-col gap-3 rounded-md border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold leading-6 text-foreground">{sectionLabel(id)}</h3>
        <Badge variant={SECTION_STATUS_VARIANT[section.status]}>{section.status}</Badge>
      </div>
      {section.summary ? (
        <p className="text-sm leading-6 text-muted-foreground">{section.summary}</p>
      ) : null}
      {section.content ? (
        <blockquote className="whitespace-pre-line border-l-0 border-t border-border pt-3 text-sm leading-6 text-foreground">
          {section.content}
        </blockquote>
      ) : null}
      {section.citations.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {section.citations.map((citation, index) => (
            <li
              key={`${citation.sourceId}-${citation.anchor ?? index}`}
              className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
            >
              <Badge variant="outline">cite</Badge>
              <span className="font-medium text-foreground">{citation.title}</span>
              {citation.anchor ? (
                <span className="font-mono text-xs">#{citation.anchor}</span>
              ) : null}
              <a
                className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                href={citation.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                open source
                <IconExternalLink className="size-3" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
