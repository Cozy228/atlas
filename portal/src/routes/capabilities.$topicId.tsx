import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowLeft } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, PageSection } from "@/components/page-section";

export const Route = createFileRoute("/capabilities/$topicId")({
  component: CapabilityDetailRoute,
});

function CapabilityDetailRoute() {
  const { topicId } = Route.useParams();
  return (
    <PageBody>
      <Link
        to="/capabilities"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="size-4" /> All capabilities
      </Link>
      <PageHeader
        eyebrow="Capability"
        title={topicId}
        description="Decision summary, getting-started entry tools, and authoritative evidence will load from the Context API in Phase P4."
        actions={<Badge variant="brand">authoritative</Badge>}
      />
      <PageSection
        title="Evidence"
        description="Sources, anchors, citations, and expansion paths will appear in an expandable rail tied to source identity."
      >
        <div className="rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Awaiting Phase P4 evidence binding.
          </p>
          <p className="mt-1 leading-6">
            Detail loads from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              GET /topics/{topicId}/context
            </code>{" "}
            parsed through{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              ContextBundleResponseSchema
            </code>
            .
          </p>
        </div>
      </PageSection>
    </PageBody>
  );
}
