import { Link } from "@tanstack/react-router";
import { IconArrowRight } from "@tabler/icons-react";

import { GuidanceTypeBadge, StepperPreview } from "@/components/guidance/shared";
import type { Guidance } from "@/lib/guidance";
import { cn } from "@/lib/utils";

export function RelatedGuidance({ items }: { items: ReadonlyArray<Guidance> }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map((guidance) => (
        <Link
          key={guidance.id}
          to="/guidance/$guidanceId"
          params={{ guidanceId: guidance.id }}
          className={cn(
            "group flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-[border-color,box-shadow]",
            "hover:border-border-strong hover:shadow-sm",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 type-detail font-bold tracking-[-0.01em] text-foreground">
              {guidance.title}
              <IconArrowRight className="size-3 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
            </p>
            <GuidanceTypeBadge type={guidance.type} />
          </div>
          <p className="line-clamp-2 type-caption leading-5 text-muted-foreground">
            {guidance.objective}
          </p>
          <div className="rounded-md border border-border bg-background/60 p-2.5">
            <StepperPreview steps={guidance.steps} max={4} />
          </div>
        </Link>
      ))}
    </div>
  );
}
