import { createFileRoute } from "@tanstack/react-router";

import { OnboardingPage } from "@/components/prototype/opus/onboarding";

export const Route = createFileRoute("/prototype/opus/onboarding")({
  component: OnboardingPage,
});
