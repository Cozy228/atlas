import { useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import type { ContextBundleResponse } from "@atlas/schema";

import { EvidencePanel } from "@/components/evidence/evidence-panel";
import { WarningStack } from "@/components/evidence/warning-stack";
import { cn } from "@/lib/utils";

type EvidenceSectionProps = {
  bundle: ContextBundleResponse;
  defaultOpen?: boolean;
};

export function EvidenceSection({
  bundle,
  defaultOpen = false,
}: EvidenceSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const sourceCount = bundle.sources.length;

  return (
    <div className="flex flex-col gap-3">
      <WarningStack warnings={bundle.warnings} />

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors",
          "hover:border-border-strong",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <div className="flex flex-col">
          <p className="text-[13px] font-bold tracking-[-0.01em] text-foreground">
            {sourceCount === 0
              ? "No registered sources"
              : `${sourceCount} ${sourceCount === 1 ? "source" : "sources"} cited`}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Authority, freshness, anchors, and excerpts expand inline.
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
      </button>

      {open ? <EvidencePanel bundle={bundle} /> : null}
    </div>
  );
}
