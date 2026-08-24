import { createFileRoute } from "@tanstack/react-router";

import { resolveApplication } from "@/components/prototype/atlas/fixtures";
import { TicketsView } from "@/components/prototype/atlas/tickets-view";

export const Route = createFileRoute("/prototype/$appId/tickets")({
  component: Page,
});

function Page() {
  const { appId } = Route.useParams();
  const application = resolveApplication(appId);
  return <TicketsView application={application} />;
}
