import { createFileRoute } from "@tanstack/react-router";

import { DeliveryView } from "@/components/prototype/atlas/delivery-view";
import { resolveApplication } from "@/components/prototype/atlas/fixtures";

export const Route = createFileRoute("/prototype/$appId/delivery")({
  component: Page,
});

function Page() {
  const { appId } = Route.useParams();
  const application = resolveApplication(appId);
  return <DeliveryView application={application} />;
}
