import { createFileRoute } from "@tanstack/react-router";

import { DiagnosisPage } from "@/components/prototype/kimi/diagnosis";

export const Route = createFileRoute("/prototype/kimi/diagnosis")({
  validateSearch: (search) => ({
    run: typeof search.run === "string" ? search.run : undefined,
  }),
  component: DiagnosisPage,
});
