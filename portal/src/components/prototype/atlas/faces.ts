/**
 * Prototype `atlas` — Workbench face registry
 * ===========================================
 * The sidebar shows the full 11-face IA from
 * docs/app-centric-experience-architecture.md §6d; only the core faces have
 * real content in this batch, the rest render structured placeholders.
 */
import {
  IconCloud,
  IconCoins,
  IconFileText,
  IconKey,
  IconLayoutDashboard,
  IconLifebuoy,
  IconRoute,
  IconRocket,
  IconServer,
  IconStethoscope,
  IconTicket,
  IconTools,
} from "@tabler/icons-react";

export type FaceId =
  | "overview"
  | "delivery"
  | "scaffold"
  | "access"
  | "tickets"
  | "docs"
  | "support"
  | "cloud"
  | "resources"
  | "cost"
  | "journeys"
  | "diagnostics";

export type FaceDef = {
  id: FaceId;
  label: string;
  shortLabel?: string;
  icon: typeof IconLayoutDashboard;
  core: boolean;
  /** The question this face answers. Shown in placeholders and sidebars. */
  purpose: string;
  /** Placeholder bullets until the face ships. */
  planned?: ReadonlyArray<string>;
};

export const FACES: ReadonlyArray<FaceDef> = [
  {
    id: "overview",
    label: "Overview",
    icon: IconLayoutDashboard,
    core: true,
    purpose: "Health verdict, what needs you, recent activity, ownership.",
  },
  {
    id: "delivery",
    label: "Delivery",
    icon: IconRocket,
    core: true,
    purpose: "Environment flow and run history across DEV, UAT and PROD.",
    planned: [
      "Environment flow rail with version drift and gates",
      "Run history table with per-stage detail",
      "In-place diagnosis on failed runs",
    ],
  },
  {
    id: "scaffold",
    label: "Scaffold",
    icon: IconTools,
    core: true,
    purpose: "Provision a new workload for this application as a governed action.",
    planned: [
      "Recipe list, ECS service first",
      "Decide → preview → generate PR → trigger delivery automation",
      "Architecture graph that fills in while provisioning runs",
    ],
  },
  {
    id: "access",
    label: "Access",
    icon: IconKey,
    core: true,
    purpose: "Who can access this application and which grants are pending.",
    planned: [
      "Pending grants highlighted at the top",
      "Grant table: who · role · status · source",
      "Request access as a governed action",
    ],
  },
  {
    id: "tickets",
    label: "Tickets & Changes",
    shortLabel: "Tickets",
    icon: IconTicket,
    core: true,
    purpose: "Tickets, changes and incidents aggregated onto this application.",
    planned: [
      "Type filters: tickets / changes / incidents",
      "Date-led timeline aggregated onto this application",
      "Open a pre-filled support ticket",
    ],
  },
  {
    id: "docs",
    label: "Documentation",
    shortLabel: "Docs",
    icon: IconFileText,
    core: true,
    purpose: "Authoritative documents for this application, with freshness.",
    planned: [
      "Numbered document sources with type and id",
      "Owner and freshness per document",
      "Deep links into source systems",
    ],
  },
  {
    id: "support",
    label: "Support",
    icon: IconLifebuoy,
    core: true,
    purpose: "Support routes by problem type, with responsible teams and escalation.",
    planned: [
      "Support routes grouped by problem type",
      "Responsible team, channel and escalation path",
      "Contact and escalate actions",
    ],
  },
  {
    id: "cloud",
    label: "Cloud & Environments",
    shortLabel: "Cloud",
    icon: IconCloud,
    core: false,
    purpose: "Accounts, subscriptions and per-environment posture.",
    planned: [
      "Accounts and subscriptions mapped to this application",
      "Per-environment posture and regions",
    ],
  },
  {
    id: "resources",
    label: "Resources",
    icon: IconServer,
    core: false,
    purpose: "Cloud resources projected under this application.",
    planned: [
      "Cloud resources projected under this application",
      "Ownership gaps surfaced honestly",
    ],
  },
  {
    id: "cost",
    label: "Cost",
    icon: IconCoins,
    core: false,
    purpose: "Cost summary attributed to this application.",
    planned: [
      "Cost summary attributed to this application",
      "Anomalies and trend context (Horizon 2)",
    ],
  },
  {
    id: "journeys",
    label: "Journeys",
    icon: IconRoute,
    core: false,
    purpose: "Other golden paths an already-onboarded application can run.",
    planned: [
      "Other golden paths an operating application can run",
      "Production readiness, secrets onboarding, migrations",
    ],
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    icon: IconStethoscope,
    core: false,
    purpose: "Archive of past diagnoses for this application.",
    planned: [
      "Archive of past diagnoses for this application",
      "Repeated-failure signals over time",
    ],
  },
];

export function faceById(id: string): FaceDef | undefined {
  return FACES.find((face) => face.id === id);
}

/** Route path segment for a face id. */
export function facePath(face: FaceDef): string {
  return `/prototype/$appId/${face.id}`;
}
