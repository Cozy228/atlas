import { Link, createFileRoute } from "@tanstack/react-router";
import { IconArrowLeft } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, PageSection } from "@/components/page-section";

export const Route = createFileRoute("/sources/$sourceId")({
  component: SourceDetailRoute,
});

function SourceDetailRoute() {
  const { sourceId } = Route.useParams();
  return (
    <PageBody>
      <Link
        to="/sources"
        className="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="size-4" /> All sources
      </Link>
      <PageHeader
        eyebrow="Source"
        title={sourceId}
        description="Source metadata, anchors, citations, expansion paths, and warning state will load from the Atlas Context API in Phase P4."
        actions={<Badge variant="info">internal</Badge>}
      />
      <PageSection title="Anchors and warnings">
        <div className="rounded-md border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            Awaiting Phase P4 evidence binding.
          </p>
          <p className="mt-1 leading-6">
            Detail loads from{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">
              GET /sources/{sourceId}
            </code>{" "}
            and surfaces broken, weak, restricted, and stale signals as
            structured warnings.
          </p>
        </div>
      </PageSection>
    </PageBody>
  );
}
