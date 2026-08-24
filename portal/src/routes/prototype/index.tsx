import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "@/components/prototype/atlas/home";
import { GlobalShell } from "@/components/prototype/atlas/shell";

export const Route = createFileRoute("/prototype/")({
  component: Page,
});

function Page() {
  return (
    <GlobalShell>
      <HomePage />
    </GlobalShell>
  );
}
