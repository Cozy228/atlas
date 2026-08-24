import { createFileRoute } from "@tanstack/react-router";

import { DiagnosticsArchiveView } from "@/components/prototype/atlas/diagnostics-archive-view";
import { resolveApplication } from "@/components/prototype/atlas/fixtures";

export const Route = createFileRoute("/prototype/$appId/diagnostics")({
  component: Page,
});

function Page() {
  const { appId } = Route.useParams();
  const application = resolveApplication(appId);
  return <DiagnosticsArchiveView application={application} />;
}
