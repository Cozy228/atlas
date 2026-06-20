/**
 * Shared fixtures for the Home "Welcome desk". Fictional and public-safe; the
 * loader-fed numbers (services, domains, regions) come from the real
 * availability projection instead.
 */

/** Mainline link targets used by the Home cards (non-parameterised routes). */
export type MainlineRoute =
  | "/"
  | "/catalog"
  | "/guidance"
  | "/skills"
  | "/sources"
  | "/overview"
  | "/whatsnew"
  | "/ask"
  | "/availability";

export type DomainService = {
  id: string;
  name: string;
  status: "ga" | "planned" | "none";
  liveRegions: number;
  plannedRegions: number;
};

export type DomainSummary = {
  domain: string;
  /** Anchor id of the matching domain shelf on `/catalog`. */
  anchor: string;
  count: number;
  /** First few service names, pre-joined for a one-line preview. */
  preview: string;
  /** One-line domain blurb for the expanded spec-sheet header. */
  blurb: string;
  /** Full service list, for the inline spec-sheet that opens on expand. */
  services: ReadonlyArray<DomainService>;
};

export type HomeLoaderData = {
  serviceCount: number;
  domainCount: number;
  regionCount: number;
  domains: ReadonlyArray<DomainSummary>;
};

export type Intent = {
  /** Short imperative verb used as the scannable left-column category. */
  verb: string;
  title: string;
  description: string;
  to: MainlineRoute;
  /** Where the door lands, in one phrase (trailing hint). */
  lands: string;
};

/** Five parallel doors, one per thing you might be trying to do. */
export const INTENTS: ReadonlyArray<Intent> = [
  {
    verb: "Build",
    title: "Start a new service",
    description: "Stand up a new workload the approved way, from access to first deploy.",
    to: "/guidance",
    lands: "Guidance routes",
  },
  {
    verb: "Browse",
    title: "Find a capability",
    description: "Browse what the platform offers, grouped by the domain it lives in.",
    to: "/catalog",
    lands: "Service catalog",
  },
  {
    verb: "Decide",
    title: "Make a platform decision",
    description: "Branch through the approved options and leave with a defensible choice.",
    to: "/guidance",
    lands: "Decision routes",
  },
  {
    verb: "Verify",
    title: "Check policy and guardrails",
    description: "Confirm what's required, and cite it, before you ship.",
    to: "/sources",
    lands: "Source registry",
  },
  {
    verb: "Watch",
    title: "See platform health",
    description: "Deployments, service health, and open incidents as they stand now.",
    to: "/overview",
    lands: "Operations overview",
  },
];

export const POPULAR: ReadonlyArray<string> = [
  "Deploy a service",
  "Data ingestion patterns",
  "Authentication flows",
  "Network setup",
];

export type RecentItem = { name: string; type: string; to: MainlineRoute };

export const RECENTS: ReadonlyArray<RecentItem> = [
  { name: "Object Storage", type: "Capability", to: "/catalog" },
  { name: "GDC Foundation", type: "Landing zone", to: "/catalog" },
  { name: "Service authentication flow", type: "Guide", to: "/guidance" },
  { name: "RBAC policy templates", type: "Policy", to: "/sources" },
];

export type Announcement = {
  kind: string;
  tone: "success" | "info" | "warning";
  title: string;
  description: string;
  date: string;
};

export const ANNOUNCEMENTS: ReadonlyArray<Announcement> = [
  {
    kind: "New",
    tone: "success",
    title: "Object Storage (S3-Compatible)",
    description:
      "Added to the catalog. Available in US-East-1 and DC16 with versioning and lifecycle rules.",
    date: "Jun 4, 2026",
  },
  {
    kind: "Policy",
    tone: "warning",
    title: "GDC Deployment Approval",
    description: "Two-step approval now required for all GDC landing zone deployments.",
    date: "Jun 2, 2026",
  },
  {
    kind: "Updated",
    tone: "info",
    title: "Kubernetes Platform",
    description: "Authority source refreshed from platform CMDB; level raised to L1.",
    date: "May 28, 2026",
  },
];

export const ANNOUNCE_TONE: Record<Announcement["tone"], string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
};

/** Compact lifecycle used where the full JourneyGrid would be too heavy. */
export type LifecyclePhase = {
  phase: string;
  title: string;
  links: ReadonlyArray<{ label: string; to: MainlineRoute }>;
};

export const LIFECYCLE: ReadonlyArray<LifecyclePhase> = [
  {
    phase: "Get started",
    title: "Understand the catalog",
    links: [
      { label: "Service catalog", to: "/catalog" },
      { label: "Availability map", to: "/availability" },
    ],
  },
  {
    phase: "Build",
    title: "Provision and configure",
    links: [{ label: "Guidance", to: "/guidance" }],
  },
  {
    phase: "Validate",
    title: "Check guardrails",
    links: [{ label: "Sources", to: "/sources" }],
  },
  {
    phase: "Operate",
    title: "Monitor and evolve",
    links: [{ label: "Operations overview", to: "/overview" }],
  },
];
