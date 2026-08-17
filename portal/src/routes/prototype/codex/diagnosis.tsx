import { createFileRoute } from "@tanstack/react-router";

import { CodexDiagnosis } from "@/components/prototype/codex/diagnosis";

export const Route = createFileRoute("/prototype/codex/diagnosis")({
  component: CodexDiagnosis,
});
