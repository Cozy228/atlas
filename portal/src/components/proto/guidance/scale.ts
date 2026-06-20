/**
 * PROTOTYPE (scale fixture) — synthetic guidance flows for stress-testing the
 * filterable "Routes" index direction at realistic volume.
 *
 * The curated catalog only carries a handful of real flows, which hides how the
 * index behaves once each family holds dozens of rows. This module generates
 * ~42 fictional, public-safe flows with enough structure that the shape metric
 * (steps / paths / checks) and the detail page both resolve.
 *
 * Wired into the `routes` variant via `scaledFlows()`; the `outcomes` default
 * keeps reading the curated destination groups. Everything here is fictional.
 */
import type { Guidance } from "@/lib/guidance";

type Spec = readonly [title: string, slug: string, destination: string, size: number];

const ROUTE_SPECS: ReadonlyArray<Spec> = [
  ["Onboard a Batch Job", "batch-job", "Batch job runs on its schedule", 4],
  ["Stand Up a Static Site", "static-site", "Static site served over the CDN", 3],
  ["Wire Up Centralized Logging", "central-logging", "Logs flow to the shared sink", 5],
  ["Publish an Internal API", "internal-api", "API reachable inside the mesh", 4],
  ["Provision a Managed Queue", "managed-queue", "Queue accepting producers", 3],
  ["Enable Request Tracing", "request-tracing", "Traces visible end to end", 4],
  ["Set Up a Scheduled Export", "scheduled-export", "Export lands in the warehouse", 5],
  ["Configure Autoscaling", "autoscaling", "Service scales with load", 4],
  ["Migrate to the Shared Registry", "shared-registry", "Images pushed to the registry", 6],
  ["Connect a Secrets Store", "secrets-store", "Secrets injected at runtime", 4],
  ["Onboard a Webhook Receiver", "webhook-receiver", "Webhooks verified and queued", 3],
  ["Bootstrap a New Environment", "new-environment", "Environment ready for deploys", 6],
  ["Enable Blue-Green Deploys", "blue-green", "Traffic shifts with no downtime", 5],
  ["Set Up Backup Restores", "backup-restore", "Restores rehearsed and timed", 4],
  ["Roll Out a Feature Flag SDK", "feature-flag-sdk", "Flags evaluated at the edge", 3],
  ["Onboard a Streaming Consumer", "streaming-consumer", "Consumer reads the topic", 5],
];

const DECISION_SPECS: ReadonlyArray<Spec> = [
  ["Choose a Messaging Pattern", "messaging-pattern", "Messaging pattern selected", 4],
  ["Pick a Compute Tier", "compute-tier", "Compute tier chosen", 3],
  ["Select a Caching Strategy", "caching-strategy", "Caching strategy decided", 3],
  ["Choose an Auth Model", "auth-model", "Auth model selected", 4],
  ["Decide a Rollout Strategy", "rollout-strategy", "Rollout strategy chosen", 3],
  ["Pick a Region Topology", "region-topology", "Region topology decided", 4],
  ["Choose a Schema Approach", "schema-approach", "Schema approach selected", 3],
  ["Select a Rate-Limit Policy", "rate-limit-policy", "Rate-limit policy chosen", 3],
  ["Decide a Tenancy Model", "tenancy-model", "Tenancy model selected", 4],
  ["Choose a Retry Policy", "retry-policy", "Retry policy decided", 3],
  ["Pick an Observability Stack", "observability-stack", "Observability stack chosen", 4],
  ["Select a Disaster-Recovery Tier", "dr-tier", "DR tier selected", 3],
];

const CHECKLIST_SPECS: ReadonlyArray<Spec> = [
  ["Pre-Launch Readiness", "pre-launch", "Service cleared to launch", 8],
  ["Production Access Review", "prod-access", "Access posture verified", 6],
  ["Cost Guardrail Check", "cost-guardrail", "Spend within guardrails", 5],
  ["Data Handling Audit", "data-handling", "Data controls confirmed", 7],
  ["Dependency Hygiene Sweep", "dependency-hygiene", "Dependencies clean", 6],
  ["Resilience Verification", "resilience-check", "Failure modes covered", 8],
  ["Compliance Sign-Off", "compliance-signoff", "Controls evidenced", 9],
  ["Accessibility Audit", "accessibility-audit", "A11y bar met", 6],
  ["Performance Budget Check", "performance-budget", "Budgets within target", 5],
  ["Secrets Exposure Sweep", "secrets-sweep", "No leaked credentials", 6],
  ["Backup Integrity Check", "backup-integrity", "Restores verified", 5],
  ["Network Exposure Review", "network-exposure", "Surface area minimized", 7],
  ["Release Notes Completeness", "release-notes", "Changelog complete", 4],
  ["Decommission Checklist", "decommission", "Service safely retired", 8],
];

const OWNERS = [
  { team: "Platform Engineering", support: "platform-eng-support" },
  { team: "Developer Experience", support: "devex-support" },
  { team: "Security Engineering", support: "security-eng-support" },
  { team: "Data Platform", support: "data-platform-support" },
  { team: "Delivery Engineering", support: "delivery-eng-support" },
] as const;

const STATUS_CYCLE: ReadonlyArray<Guidance["status"]> = [
  "published",
  "published",
  "published",
  "needs_review",
  "published",
  "draft",
  "published",
  "deprecated",
];

function buildRoute([title, slug, dest, size]: Spec, i: number): Guidance {
  const steps: Guidance["steps"] = [
    ...Array.from({ length: size }, (_, n) => ({
      id: `step-${n}`,
      title: `Step ${n + 1}`,
      kind: "action" as const,
      description: `Carry out part ${n + 1} of ${title.toLowerCase()}.`,
    })),
    { id: "done", title: dest, kind: "destination" as const, description: dest },
  ];
  return baseFlow(title, slug, "route", "enable", dest, i, steps);
}

function buildDecision([title, slug, dest, size]: Spec, i: number): Guidance {
  const steps: Guidance["steps"] = [
    {
      id: "pick",
      title: "Pick an option",
      kind: "decision" as const,
      description: `Branch through the approved options for ${title.toLowerCase()}.`,
      options: Array.from({ length: size }, (_, n) => ({
        id: `opt-${n}`,
        title: `Option ${n + 1}`,
        description: `Trade-off ${n + 1} for this decision.`,
      })),
    },
    { id: "decided", title: dest, kind: "destination" as const, description: dest },
  ];
  return baseFlow(title, slug, "decision", "decide", dest, i, steps);
}

function buildChecklist([title, slug, dest, size]: Spec, i: number): Guidance {
  const steps: Guidance["steps"] = [
    {
      id: "checks",
      title: "Run the checks",
      kind: "checklist" as const,
      description: `Verify the conditions for ${title.toLowerCase()}.`,
      tasks: Array.from({ length: size }, (_, n) => ({
        id: `check-${n}`,
        title: `Check ${n + 1}`,
        required: n % 2 === 0,
      })),
    },
    { id: "cleared", title: dest, kind: "destination" as const, description: dest },
  ];
  return baseFlow(title, slug, "checklist", "validate", dest, i, steps);
}

/** Deterministic review dates spread across 2026 H1, so the Ledger sort bites. */
function reviewDate(i: number): string {
  const month = ((i * 5) % 6) + 1;
  const day = ((i * 7) % 27) + 1;
  return `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function baseFlow(
  title: string,
  slug: string,
  type: Guidance["type"],
  family: Guidance["family"],
  dest: string,
  i: number,
  steps: Guidance["steps"],
): Guidance {
  return {
    id: `scale-${slug}`,
    title,
    type,
    scenario: "service_enablement",
    family,
    objective: `${title} following the approved platform path.`,
    destination: { title: dest, description: dest },
    owner: OWNERS[i % OWNERS.length]!,
    status: STATUS_CYCLE[i % STATUS_CYCLE.length]!,
    version: "1.0.0",
    lastReviewed: reviewDate(i),
    steps,
  };
}

/** ~42 fictional flows spread across the three shapes for scale review. */
export const SCALE_FLOWS: ReadonlyArray<Guidance> = [
  ...ROUTE_SPECS.map(buildRoute),
  ...DECISION_SPECS.map(buildDecision),
  ...CHECKLIST_SPECS.map(buildChecklist),
];
