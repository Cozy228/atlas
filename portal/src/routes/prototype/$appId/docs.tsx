import { createFileRoute } from "@tanstack/react-router";

import { DocsView } from "@/components/prototype/atlas/docs-view";
import { resolveApplication } from "@/components/prototype/atlas/fixtures";

export const Route = createFileRoute("/prototype/$appId/docs")({
  component: Page,
});

function Page() {
  const { appId } = Route.useParams();
  const application = resolveApplication(appId);
  return <DocsView application={application} />;
}
