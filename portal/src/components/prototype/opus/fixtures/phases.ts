/**
 * Prototype `opus` — golden path phases
 * =====================================
 * Shared by both fixture applications: the golden path is versioned platform
 * content, so two applications running it see the same phases in the same order.
 */
import type { JourneyPhase } from "./types";

export const CONTAINER_PATH_PHASES: ReadonlyArray<JourneyPhase> = [
  {
    id: "identify",
    label: "Identify",
    outcome: "Atlas knows which application this is and which shape of workload it runs.",
  },
  {
    id: "access",
    label: "Access",
    outcome: "You and the pipeline are entitled to act in DEV.",
  },
  {
    id: "foundation",
    label: "Foundation",
    outcome: "Account, region and repository are mapped to the application.",
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    outcome: "DEV infrastructure exists and publishes the outputs delivery needs.",
  },
  {
    id: "delivery",
    label: "Delivery",
    outcome: "A pipeline can build a revision and ship it.",
  },
  {
    id: "runtime",
    label: "Runtime",
    outcome: "Configuration and secrets the service reads at start-up exist.",
  },
  {
    id: "deploy",
    label: "Deploy",
    outcome: "A revision is running in DEV.",
  },
  {
    id: "verify",
    label: "Verify",
    outcome: "The running revision answers, and the outcome is recorded with evidence.",
  },
];

export const COMPLETION_CRITERIA: ReadonlyArray<string> = [
  "Application resolved to an owning team with a named technical contact.",
  "Deploy entitlement active for the pipeline identity and at least one engineer.",
  "Infrastructure applied in DEV with all four required outputs published.",
  "A revision built from the default branch is running in DEV.",
  "The service answers its readiness endpoint twice, five minutes apart.",
  "Every completed step carries evidence from the system that performed it.",
];
