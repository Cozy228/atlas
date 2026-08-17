import { createFileRoute } from "@tanstack/react-router";

import { CodexDashboard } from "@/components/prototype/codex/dashboard";

export const Route = createFileRoute("/prototype/codex/dashboard")({
  component: CodexDashboard,
});
