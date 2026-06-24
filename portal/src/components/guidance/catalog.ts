/**
 * Guidance catalog axis — indexes the registry-backed guidances by category.
 *
 * Sources every flow from `lib/guidance` (the YAML-backed registry; no
 * fixtures), classifies each into ONE category (first keyword rule wins), and
 * maps a guidance's `type` to a flow-shape label + the metric that reads
 * naturally for that shape (Walkthrough · N steps / Decision · N paths /
 * Checklist · N checks). The detail route resolves through `resolveGuidanceFlow`.
 */
import { getGuidance, listGuidance, type Guidance, type GuidanceType } from "@/lib/guidance";

/** Resolve a guidance flow by id (the registry-backed guidances). */
export function resolveGuidanceFlow(id: string): Guidance | undefined {
  return getGuidance(id);
}

/** Every catalog flow, flat. */
export function allGuidance(): ReadonlyArray<Guidance> {
  return listGuidance();
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
