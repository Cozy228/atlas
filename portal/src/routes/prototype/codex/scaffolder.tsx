import { createFileRoute } from "@tanstack/react-router";

import { CodexScaffolder } from "@/components/prototype/codex/scaffolder";

export const Route = createFileRoute("/prototype/codex/scaffolder")({
  component: CodexScaffolder,
});
