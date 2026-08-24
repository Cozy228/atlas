import { createFileRoute } from "@tanstack/react-router";

import { OnboardingView } from "@/components/prototype/atlas/onboard-view";
import { GlobalShell } from "@/components/prototype/atlas/shell";

export const Route = createFileRoute("/prototype/onboard")({
  component: Page,
});

function Page() {
  return (
    <GlobalShell>
      <OnboardingView />
    </GlobalShell>
  );
}
