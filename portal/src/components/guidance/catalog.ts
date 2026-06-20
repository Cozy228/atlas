/**
 * proto-local guidance catalog.
 *
 * Round 2 reorganises the guidance index around *where a flow takes you*
 * (the destination / outcome), not the old scenario families
 * (onboard/decide/enable/validate). This module:
 *
 *   - re-exports the shared `lib/guidance` fixtures, plus a few proto-only
 *     flows so each destination group has real density (public-safe, fictional);
 *   - groups every flow under an outcome band (DESTINATION_GROUPS);
 *   - maps a guidance's `type` to a flow-shape label + the metric that reads
 *     naturally for that shape (Walkthrough · N steps / Decision · N paths /
 *     Checklist · N checks).
 *
 * The shared `lib/guidance.ts` is left untouched (mainline /guidance keeps its
 * family model). The detail route resolves through `resolveGuidanceFlow` so
 * the portal-only flows open and track progress like the real ones.
 */
import { getGuidance, listGuidance, type Guidance, type GuidanceType } from "@/lib/guidance";

/* -------------------------------------------------------------------------- *
 * Proto-only flows — fictional, public-safe; reuse existing source ids so the
 * evidence rows resolve against the real source registry.
 * -------------------------------------------------------------------------- */

const PROTO_EXTRA: ReadonlyArray<Guidance> = [
  {
    id: "connect-deploy-pipeline",
    title: "Connect a Deployment Pipeline",
    type: "route",
    scenario: "service_enablement",
    family: "enable",
    objective:
      "Wire an onboarded service to the approved CI/CD path so changes promote dev → staging → prod automatically.",
    destination: {
      title: "Service deploys through the standard pipeline",
      description: "Every merge promotes through the approved stages with no console steps.",
    },
    owner: { team: "Delivery Engineering", support: "delivery-eng-support" },
    status: "published",
    version: "1.1.0",
    lastReviewed: "2026-05-20",
    appliesTo: { services: ["serverless-compute"] },
    steps: [
      {
        id: "pick-template",
        title: "Pick a pipeline template",
        kind: "action",
        description: "Choose the approved pipeline template that matches your runtime.",
        why: "Templates carry the guardrail steps and promotion gates your zone requires.",
        tasks: [
          {
            id: "open-templates",
            title: "Open the pipeline template gallery",
            required: true,
            action: {
              type: "tool_link",
              label: "Open templates",
              target: "https://example.internal/pipelines",
            },
          },
        ],
      },
      {
        id: "wire-repo",
        title: "Connect your repository",
        kind: "action",
        description: "Grant the pipeline read access and register the default branch.",
        why: "The pipeline triggers on merges to the registered branch only.",
        tasks: [
          { id: "install-app", title: "Install the delivery app on the repo", required: true },
          { id: "set-branch", title: "Register the default branch" },
        ],
      },
      {
        id: "map-environments",
        title: "Map environments",
        kind: "action",
        description: "Bind each stage to its target environment and approvers.",
        why: "Promotion gates are only as good as the approver mapping behind them.",
        tasks: [
          { id: "bind-stages", title: "Bind dev / staging / prod targets", required: true },
          { id: "set-approvers", title: "Set prod promotion approvers", required: true },
        ],
        sources: ["iam-boundary-policy"],
      },
      {
        id: "first-deploy",
        title: "Run the first promoted deploy",
        kind: "checklist",
        description: "Confirm a change flows end to end before handing the pipeline over.",
        why: "A dry first run surfaces missing secrets and gate misconfiguration early.",
        tasks: [
          { id: "merge-change", title: "Merge a no-op change", required: true },
          { id: "watch-promote", title: "Watch it promote to staging", required: true },
          { id: "approve-prod", title: "Approve the prod promotion" },
        ],
        sources: ["logging-standard-doc"],
      },
      {
        id: "done",
        title: "Pipeline connected",
        kind: "destination",
        description: "Changes now promote automatically through the standard path.",
      },
    ],
  },
  {
    id: "choose-data-store",
    title: "Choose a Managed Data Store",
    type: "decision",
    scenario: "service_enablement",
    family: "decide",
    objective: "Match a workload's data shape and access pattern to an approved managed store.",
    destination: {
      title: "Data store selected with rationale",
      description:
        "You can justify the chosen store against its access pattern and durability needs.",
    },
    owner: { team: "Data Platform", support: "data-platform-support" },
    status: "published",
    version: "1.0.0",
    lastReviewed: "2026-04-09",
    steps: [
      {
        id: "characterize",
        title: "Characterize the data",
        kind: "action",
        description: "Capture the access pattern, consistency needs, and expected volume.",
        why: "Store fit is driven by how the data is read and written, not how it is stored.",
        tasks: [
          { id: "access-pattern", title: "Describe the dominant access pattern", required: true },
          { id: "consistency", title: "Note consistency and durability needs" },
        ],
      },
      {
        id: "pick-store",
        title: "Pick a store",
        kind: "decision",
        description: "Select the managed store whose guarantees match your characterization.",
        why: "Each store trades flexibility, latency, and cost differently.",
        options: [
          {
            id: "relational",
            title: "Managed Relational",
            description: "Transactional, strongly-typed data with joins and constraints.",
          },
          {
            id: "document",
            title: "Managed Document",
            description: "Flexible schemas and nested records read by key or query.",
          },
          {
            id: "keyvalue",
            title: "Managed Cache / KV",
            description: "Hot, ephemeral lookups where latency dominates.",
          },
          {
            id: "object",
            title: "Object Storage",
            description: "Large blobs and artifacts addressed by key.",
          },
        ],
      },
      {
        id: "decided",
        title: "Store selected",
        kind: "destination",
        description: "Continue to provisioning with the chosen store.",
      },
    ],
  },
  {
    id: "security-review-gate",
    title: "Clear the Security Review Gate",
    type: "checklist",
    scenario: "production_readiness",
    family: "validate",
    objective: "Confirm a service meets the platform security bar before its review sign-off.",
    destination: {
      title: "Service cleared for security sign-off",
      description: "Every required control is understood and satisfied ahead of the review.",
    },
    owner: { team: "Security Engineering", support: "security-eng-support" },
    status: "published",
    version: "1.3.0",
    lastReviewed: "2026-05-31",
    appliesTo: { guardrails: ["iam-boundary"] },
    sources: ["iam-boundary-policy"],
    steps: [
      {
        id: "secrets",
        title: "Secrets and credentials",
        kind: "checklist",
        description: "Confirm no secret material ships in code or images.",
        why: "Leaked credentials are the most common hard blocker at review.",
        tasks: [
          { id: "no-hardcoded", title: "No hardcoded secrets in the repo", required: true },
          {
            id: "rotation",
            title: "Rotation policy configured for issued credentials",
            required: true,
          },
        ],
      },
      {
        id: "network",
        title: "Network exposure",
        kind: "checklist",
        description: "Confirm the service exposes only what it must.",
        why: "Default-open ingress is a frequent review finding.",
        tasks: [
          { id: "no-public", title: "No unintended public ingress", required: true },
          { id: "tls", title: "TLS enforced on all external endpoints", required: true },
        ],
        sources: ["iam-boundary-policy"],
        marker: "needs_support",
      },
      {
        id: "dependencies",
        title: "Dependency hygiene",
        kind: "checklist",
        description: "Confirm third-party code is scanned and pinned.",
        why: "Unpinned or vulnerable dependencies block sign-off.",
        tasks: [
          { id: "scan", title: "Dependency scan passing", required: true },
          { id: "pinned", title: "Production dependencies pinned" },
        ],
      },
      {
        id: "cleared",
        title: "Review gate cleared",
        kind: "destination",
        description: "The service meets the security bar for sign-off.",
      },
    ],
  },
];

const PROTO_BY_ID: ReadonlyMap<string, Guidance> = new Map([
  ...listGuidance().map((g) => [g.id, g] as const),
  ...PROTO_EXTRA.map((g) => [g.id, g] as const),
]);

/** Resolve a proto guidance by id (portal-only flows + shared fixtures). */
export function resolveGuidanceFlow(id: string): Guidance | undefined {
  return PROTO_BY_ID.get(id) ?? getGuidance(id);
}

/** Every catalog flow, flat: curated lib fixtures + the authored authored extras. */
export function allGuidance(): ReadonlyArray<Guidance> {
  return [...listGuidance(), ...PROTO_EXTRA];
}

/* -------------------------------------------------------------------------- *
 * Category — the index axis. Every guidance carries ONE flat category: its
 * subject area, the way a process catalog is filed. Not an imposed lifecycle,
 * just what the guidance is about. Each flow is classified into exactly one
 * category by the first keyword rule it matches, so the axis scales with the
 * catalog instead of hand-listing ids.
 * -------------------------------------------------------------------------- */

export type GuidanceCategory = {
  id: string;
  /** Short category name — shown as a tab / rail entry / section head. */
  label: string;
  /** One line on the kind of work this category holds. */
  blurb: string;
};

export const GUIDANCE_CATEGORIES: ReadonlyArray<GuidanceCategory> = [
  {
    id: "applications",
    label: "Applications",
    blurb: "Stand workloads up and get them serving on the platform.",
  },
  {
    id: "data",
    label: "Data",
    blurb: "Stores, streams, queues, and the data that moves between them.",
  },
  {
    id: "security",
    label: "Security",
    blurb: "Secrets, access, and the reviews that clear a security bar.",
  },
  {
    id: "operations",
    label: "Operations",
    blurb: "Run, observe, scale, and recover a service once it is live.",
  },
  {
    id: "platform",
    label: "Platform",
    blurb: "Foundational choices the rest of your service inherits.",
  },
];

const has = (g: Guidance, ...needles: string[]): boolean => {
  // Title + id + destination only — the objective is prose and over-matches
  // broad words like "access", miscategorising flows.
  const hay = `${g.title} ${g.id} ${g.destination.title}`.toLowerCase();
  return needles.some((n) => hay.includes(n));
};

/** Classify one flow into a single category id (first rule wins). */
function categoryIdOf(g: Guidance): string {
  if (
    has(
      g,
      "secret",
      "credential",
      "auth",
      "access",
      "network exposure",
      "compliance",
      "dependency",
      "iam",
      "security",
    )
  )
    return "security";
  if (
    has(
      g,
      "data store",
      "data handling",
      "queue",
      "messaging",
      "cache",
      "caching",
      "schema",
      "export",
      "warehouse",
      "stream",
    )
  )
    return "data";
  if (
    has(
      g,
      "logging",
      "tracing",
      "autoscal",
      "backup",
      "restore",
      "feature flag",
      "observability",
      "resilience",
      "retry",
      "rate-limit",
      "performance",
      "decommission",
      "registry",
      "disaster",
      "release notes",
      "blue-green",
    )
  )
    return "operations";
  if (
    has(
      g,
      "landing zone",
      "region",
      "compute tier",
      "tenancy",
      "rollout",
      "cost",
      "environment",
      "guardrail",
    )
  )
    return "platform";
  return "applications";
}

export function categoryOf(g: Guidance): GuidanceCategory {
  const id = categoryIdOf(g);
  return GUIDANCE_CATEGORIES.find((c) => c.id === id) ?? GUIDANCE_CATEGORIES[0]!;
}

export type CategoryGroup = { category: GuidanceCategory; items: ReadonlyArray<Guidance> };

/** Categories resolved to their flows, in catalog order; empty ones dropped. */
export function categoryGroups(): ReadonlyArray<CategoryGroup> {
  const flows = allGuidance();
  return GUIDANCE_CATEGORIES.map((category) => ({
    category,
    items: flows.filter((g) => categoryIdOf(g) === category.id),
  })).filter((entry) => entry.items.length > 0);
}

/* -------------------------------------------------------------------------- *
 * Journey length — a flow's size, surfaced quietly on each index row so a
 * short route reads differently from a long one without exposing the internal
 * shape vocabulary.
 * -------------------------------------------------------------------------- */

/** How many steps a flow runs (its `flowMetric` count, shape label dropped). */
export function journeyWeight(g: Guidance): number {
  return flowMetric(g).value;
}

/** The most recently reviewed flows — surfaced as a "what changed" entry point. */
export function recentlyUpdated(n: number): ReadonlyArray<Guidance> {
  return [...allGuidance()]
    .sort((a, b) => b.lastReviewed.localeCompare(a.lastReviewed))
    .slice(0, n);
}

/* -------------------------------------------------------------------------- *
 * Flow shape — the proto `type` vocabulary, still read by the detail view.
 * -------------------------------------------------------------------------- */

export const FLOW_SHAPE: Record<GuidanceType, string> = {
  route: "Walkthrough",
  decision: "Decision",
  checklist: "Checklist",
};

/** The metric that reads naturally for a flow's shape. */
export function flowMetric(guidance: Guidance): { value: number; unit: string } {
  const steps = guidance.steps.filter((s) => s.kind !== "destination");
  switch (guidance.type) {
    case "decision": {
      const paths = guidance.steps.reduce((n, s) => n + (s.options?.length ?? 0), 0);
      return { value: paths, unit: paths === 1 ? "path" : "paths" };
    }
    case "checklist": {
      const checks = guidance.steps.reduce((n, s) => n + (s.tasks?.length ?? 0), 0);
      return { value: checks, unit: checks === 1 ? "check" : "checks" };
    }
    default:
      return { value: steps.length, unit: steps.length === 1 ? "step" : "steps" };
  }
}

export function flowTotal(): number {
  return allGuidance().length;
}
