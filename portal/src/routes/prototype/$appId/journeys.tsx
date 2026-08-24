import { createFileRoute } from "@tanstack/react-router";

import { faceById } from "@/components/prototype/atlas/faces";
import { FacePlaceholder } from "@/components/prototype/atlas/ui";

export const Route = createFileRoute("/prototype/$appId/journeys")({
  component: Page,
});

function Page() {
  const { appId } = Route.useParams();
  const face = faceById("journeys");
  if (face === undefined) throw new Error("Unknown face: journeys");
  return <FacePlaceholder face={face} appId={appId} />;
}
