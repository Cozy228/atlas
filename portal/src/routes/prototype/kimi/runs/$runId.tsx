import { createFileRoute } from "@tanstack/react-router";

import { RunDetailPage } from "@/components/prototype/kimi/run-detail";

export const Route = createFileRoute("/prototype/kimi/runs/$runId")({
  component: RunRoute,
});

function RunRoute() {
  const { runId } = Route.useParams();
  return <RunDetailPage runId={runId} />;
}
