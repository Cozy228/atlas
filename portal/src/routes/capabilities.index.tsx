import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, PageSection } from "@/components/page-section";

export const Route = createFileRoute("/capabilities/")({
  component: CapabilitiesListRoute,
});

function CapabilitiesListRoute() {
  return (
    <PageBody>
      <PageHeader
        eyebrow="Discovery"
        title="Capabilities"
        description="Approved cloud platform capabilities. Filter by category, owner, and warning state. Phase P3 wires this list to the Atlas Context API."
        actions={
          <Badge variant="brand">topic_type = capability</Badge>
        }
      />
      <PageSection
        title="Comparison list"
        description="Dense rows with authority, freshness, visibility, and warning badges land here once the loader is connected."
      >
        <div className="rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Awaiting Phase P3 data binding.
          </p>
          <p className="mt-1 leading-6">
            The list will be loaded server-side from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              GET /topics?topic_type=capability
            </code>{" "}
            and parsed through{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              TopicDiscoveryResponseSchema
            </code>
            .
          </p>
        </div>
      </PageSection>
    </PageBody>
  );
}
