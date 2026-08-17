import { createFileRoute } from "@tanstack/react-router";

import { DiagnosisPage } from "@/components/prototype/opus/diagnosis";

export const Route = createFileRoute("/prototype/opus/diagnosis")({
  validateSearch: (search) => ({
    run: typeof search.run === "string" ? search.run : undefined,
  }),
  component: DiagnosisPage,
});
