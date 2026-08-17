import { createFileRoute } from "@tanstack/react-router";

import { ScaffolderPage } from "@/components/prototype/kimi/scaffolder";

export const Route = createFileRoute("/prototype/kimi/scaffolder")({
  component: ScaffolderPage,
});
