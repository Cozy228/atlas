import { createFileRoute } from "@tanstack/react-router";
import { IconLockBolt, IconMessage2 } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, PageSection } from "@/components/page-section";

export const Route = createFileRoute("/ask")({
  component: AskAtlasRoute,
});

function AskAtlasRoute() {
  return (
    <PageBody>
      <PageHeader
        eyebrow="Ask Atlas"
        title="Cited platform answers"
        description="Ask Atlas is one consumer of the Atlas Context API. The full cited-answer flow is deferred until evidence surfaces are stable."
        actions={<Badge variant="outline">Deferred until P5</Badge>}
      />

      <PageSection title="Boundary">
        <ul className="grid gap-3 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
          <li className="flex flex-col gap-1 rounded-md border border-border bg-card p-4">
            <span className="flex items-center gap-2 text-foreground">
              <IconMessage2 className="size-4 text-muted-foreground" />
              Question scope
            </span>
            Answers are built only from authoritative context bundles plus the
            user question. No browsing, no general retrieval.
          </li>
          <li className="flex flex-col gap-1 rounded-md border border-border bg-card p-4">
            <span className="flex items-center gap-2 text-foreground">
              <IconLockBolt className="size-4 text-muted-foreground" />
              Evidence first
            </span>
            Claims without a citation are blocked. Restricted, stale, broken,
            and conflict warnings appear above the answer.
          </li>
        </ul>
      </PageSection>

      <PageSection title="Deferred state">
        <div className="rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Composer disabled in V1 P0/P1.
          </p>
          <p className="mt-1 leading-6">
            Phase P5 lands the question composer, server-side prompt
            construction, citation validation, and per-user rate limits. We do
            not show a working answer surface until those guarantees ship.
          </p>
        </div>
      </PageSection>
    </PageBody>
  );
}
