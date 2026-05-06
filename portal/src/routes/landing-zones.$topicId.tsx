import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowLeft } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, PageSection } from "@/components/page-section";

export const Route = createFileRoute("/landing-zones/$topicId")({
  component: LandingZoneDetailRoute,
});

function LandingZoneDetailRoute() {
  const { topicId } = Route.useParams();
  return (
    <PageBody>
      <Link
        to="/landing-zones"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="size-4" /> All landing zones
      </Link>
      <PageHeader
        eyebrow="Landing zone"
        title={topicId}
        description="Environment matrix, guardrail excerpts, and provisioning entry tools land in Phase P4 once context bundles are wired."
        actions={<Badge variant="brand">authoritative</Badge>}
      />
      <PageSection title="Guardrail evidence">
        <div className="rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Awaiting Phase P4 evidence binding.
          </p>
          <p className="mt-1 leading-6">
            Detail loads from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              GET /topics/{topicId}/context
            </code>{" "}
            and renders the guardrail anchors visibly tied to source identity.
          </p>
        </div>
      </PageSection>
    </PageBody>
  );
}
