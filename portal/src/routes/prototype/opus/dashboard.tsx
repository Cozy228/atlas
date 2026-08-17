import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/components/prototype/opus/dashboard";

export const Route = createFileRoute("/prototype/opus/dashboard")({
  component: DashboardPage,
});
