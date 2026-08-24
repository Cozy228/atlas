import { createFileRoute } from "@tanstack/react-router";

import { AccessView } from "@/components/prototype/atlas/access-view";
import { resolveApplication } from "@/components/prototype/atlas/fixtures";

export const Route = createFileRoute("/prototype/$appId/access")({
  component: Page,
});

function Page() {
  const { appId } = Route.useParams();
  const application = resolveApplication(appId);
  return <AccessView application={application} />;
}
