import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import type { ResourceContextResponse, ResourceWarning } from "@atlas/schema";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EvidencePanel } from "@/components/evidence/evidence-panel";
import { WarningStack } from "@/components/evidence/warning-stack";
import { cn } from "@/lib/utils";

type EvidenceSectionProps = {
  projection: ResourceContextResponse;
  defaultOpen?: boolean;
};

/** Aggregate every Section's warnings plus the missing-section gaps into one
 *  deduped list for the header WarningStack. ResourceWarning ({code,message})
 *  is structurally a Warning, so the stack renders it directly. */
function projectionWarnings(projection: ResourceContextResponse): ResourceWarning[] {
  const all: ResourceWarning[] = [
    ...Object.values(projection.sections).flatMap((section) => section.warnings),
    ...projection.missingSections.map((missing) => ({
      code: missing.code,
      message: missing.message,
    })),
  ];
  const seen = new Set<string>();
  return all.filter((warning) => {
    const key = `${warning.code}::${warning.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function EvidenceSection({ projection, defaultOpen = false }: EvidenceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const sectionCount = Object.keys(projection.sections).length;

  return (
    <div className="flex flex-col gap-3">
      <WarningStack warnings={projectionWarnings(projection)} />

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors",
            "hover:border-border-strong",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <div className="flex flex-col">
            <p className="type-detail font-bold tracking-[-0.01em] text-foreground">
              {sectionCount === 0
                ? "No resolved sections"
                : `${sectionCount} ${sectionCount === 1 ? "section" : "sections"}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Live-resolved content and citations expand inline.
            </p>
          </div>
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          >
            <IconChevronDown className="size-3.5" />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <EvidencePanel projection={projection} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
