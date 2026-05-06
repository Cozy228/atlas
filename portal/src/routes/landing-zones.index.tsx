import { createFileRoute } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, PageSection } from "@/components/page-section";

export const Route = createFileRoute("/landing-zones/")({
  component: LandingZonesListRoute,
});

function LandingZonesListRoute() {
  return (
    <PageBody>
      <PageHeader
        eyebrow="Discovery"
        title="Landing zones"
        description="Compare environments, guardrails, and provisioning entry tools. Phase P3 wires the comparison matrix to live topics."
        actions={<Badge variant="brand">topic_type = landing-zone</Badge>}
      />
      <PageSection
        title="Comparison matrix"
        description="Environment coverage and guardrail summary will be expressed as dense rows, not decorative cards."
      >
        <div className="rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Awaiting Phase P3 data binding.
          </p>
          <p className="mt-1 leading-6">
            The matrix loads from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              GET /topics?topic_type=landing-zone
            </code>{" "}
            with environment and guardrail anchors expanded for visible
            comparison.
          </p>
        </div>
      </PageSection>
    </PageBody>
  );
}
