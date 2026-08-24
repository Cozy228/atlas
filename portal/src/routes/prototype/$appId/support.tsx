import { createFileRoute } from "@tanstack/react-router";

import { resolveApplication } from "@/components/prototype/atlas/fixtures";
import { SupportView } from "@/components/prototype/atlas/support-view";

export const Route = createFileRoute("/prototype/$appId/support")({
  component: Page,
});

function Page() {
  const { appId } = Route.useParams();
  const application = resolveApplication(appId);
  return <SupportView application={application} />;
}
