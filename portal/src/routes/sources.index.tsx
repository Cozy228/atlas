import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, PageSection } from "@/components/page-section";

export const Route = createFileRoute("/sources/")({
  component: SourcesListRoute,
});

function SourcesListRoute() {
  return (
    <PageBody>
      <PageHeader
        eyebrow="Discovery"
        title="Sources"
        description="Authoritative source lookup. Filter by source class, authority level, visibility, steward, and warning state. Phase P3 wires this list to live source discovery."
        actions={
          <Badge variant="brand">/sources</Badge>
        }
      />
      <PageSection
        title="Source registry"
        description="Each row will carry source class, steward, authority, freshness, visibility, anchor count, and any warnings tied to source identity."
      >
        <div className="rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Awaiting Phase P3 data binding.
          </p>
          <p className="mt-1 leading-6">
            Sources load from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              GET /sources
            </code>{" "}
            parsed through{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              SourceDiscoveryResponseSchema
            </code>
            .
          </p>
        </div>
      </PageSection>
    </PageBody>
  );
}
