import { ThemeProvider } from "@/lib/theme";
import { createFileRoute } from "@tanstack/react-router";
import { AskAtlasFab } from "@/components/ask-atlas-fab";
import { AskAtlasProvider } from "@/components/ask-atlas/context";
import { OnboardingNew } from "@/components/prototype/onboarding-new/page";

export const Route = createFileRoute("/prototype/onboarding-new")({ component: OnboardingRoute });

function OnboardingRoute() {
  return (
    <ThemeProvider>
      <AskAtlasProvider>
        <OnboardingNew />
        <AskAtlasFab />
      </AskAtlasProvider>
    </ThemeProvider>
  );
}
