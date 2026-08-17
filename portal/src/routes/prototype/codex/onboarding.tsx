import { createFileRoute } from "@tanstack/react-router";

import { CodexOnboarding } from "@/components/prototype/codex/onboarding";

export const Route = createFileRoute("/prototype/codex/onboarding")({
  component: CodexOnboarding,
});
