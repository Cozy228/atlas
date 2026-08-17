import { createFileRoute } from "@tanstack/react-router";

import { OnboardingPage } from "@/components/prototype/kimi/onboarding";

export const Route = createFileRoute("/prototype/kimi/onboarding")({
  validateSearch: (search) => ({
    stage: typeof search.stage === "string" ? search.stage : undefined,
  }),
  component: OnboardingPage,
});
