import { createFileRoute } from "@tanstack/react-router";

import { resolveApplication } from "@/components/prototype/atlas/fixtures";
import { ScaffoldView } from "@/components/prototype/atlas/scaffold-view";

export const Route = createFileRoute("/prototype/$appId/scaffold")({
  component: Page,
});

function Page() {
  const { appId } = Route.useParams();
  const application = resolveApplication(appId);
  return <ScaffoldView application={application} />;
}
