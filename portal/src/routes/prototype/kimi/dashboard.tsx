import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "@/components/prototype/kimi/dashboard";

export const Route = createFileRoute("/prototype/kimi/dashboard")({
  component: DashboardPage,
});
