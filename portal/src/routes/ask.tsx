import { createFileRoute } from "@tanstack/react-router";
import { IconLockBolt, IconMessage2, IconSparkles } from "@tabler/icons-react";

import { DetailHeader, DetailSection } from "@/components/detail/detail-shell";
import { PageBody } from "@/components/page-section";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ask")({
  component: AskAtlasRoute,
});

function AskAtlasRoute() {
  return (
    <PageBody width="comfortable">
      <DetailHeader
        eyebrow="Ask Atlas"
        title="Cited platform answers"
        description="Ask Atlas is one consumer of the Atlas Context API. The full cited-answer flow is deferred until evidence surfaces are stable; in the meantime the FAB on every page exposes the same boundary copy."
        badges={<Badge variant="outline">Deferred until P5</Badge>}
      />

      <DetailSection
        eyebrow="Boundary"
        title="What Ask Atlas will and will not do"
        description="Defined now so the surface ships with the same evidence-first contract as the rest of the portal."
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          <BoundaryCard
            icon={IconMessage2}
            title="Question scope"
            description="Answers are built only from authoritative context bundles plus the user question. No browsing, no general retrieval."
          />
          <BoundaryCard
            icon={IconLockBolt}
            title="Evidence first"
            description="Claims without a citation are blocked. Restricted, stale, broken, and conflict warnings appear above the answer."
          />
          <BoundaryCard
            icon={IconSparkles}
            title="Server-side composition"
            description="Prompt construction, citation validation, and per-user rate limits run in the Portal server boundary, not the browser."
          />
          <BoundaryCard
            icon={IconMessage2}
            title="Cited answer surface"
            description="Each claim maps to a citation chip. Hovering an answer paragraph highlights its source in the evidence rail."
          />
        </ul>
      </DetailSection>

      <DetailSection
        eyebrow="Status"
        title="Composer disabled until evidence surfaces are ready"
      >
        <div className="rounded-lg border border-dashed border-border bg-card p-5 text-[13px] text-muted-foreground">
          <p className="font-bold text-foreground">
            Ask Atlas ships alongside the Phase P5 evidence guarantees.
          </p>
          <p className="mt-1 leading-6">
            Until then, the FAB at the bottom-right opens this same deferred
            view in a modal so the product narrative stays visible without
            implying a working AI flow.
          </p>
        </div>
      </DetailSection>
    </PageBody>
  );
}

function BoundaryCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof IconMessage2;
  title: string;
  description: string;
}) {
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-card p-4",
      )}
    >
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-md bg-brand-tint"
      >
        <Icon className="size-3.5 text-primary" />
      </span>
      <p className="text-[13px] font-bold text-foreground">{title}</p>
      <p className="text-[12px] leading-5 text-muted-foreground">
        {description}
      </p>
    </li>
  );
}
