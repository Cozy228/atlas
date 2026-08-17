import { createFileRoute } from "@tanstack/react-router";

import { ScaffolderPage } from "@/components/prototype/opus/scaffolder";

export const Route = createFileRoute("/prototype/opus/scaffolder")({
  validateSearch: (search) => ({
    intent: typeof search.intent === "string" ? search.intent : undefined,
  }),
  component: ScaffolderPage,
});
