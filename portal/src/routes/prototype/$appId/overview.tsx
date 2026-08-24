import { createFileRoute } from "@tanstack/react-router";

import { resolveApplication } from "@/components/prototype/atlas/fixtures";
import { OverviewPage } from "@/components/prototype/atlas/workbench-overview";

export const Route = createFileRoute("/prototype/$appId/overview")({
  component: Page,
});

function Page() {
  const { appId } = Route.useParams();
  return <OverviewPage application={resolveApplication(appId)} />;
}
