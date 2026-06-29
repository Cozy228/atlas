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
  | "/sources"
  | "/whatsnew"
  | "/support"
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

/** A recent newsletter entry surfaced on the home "What's new" ticker. */
export type HomeAnnouncement = { kind: string; title: string };

export type HomeStats = {
  serviceCount: number;
  domainCount: number;
  regionCount: number;
  domains: ReadonlyArray<DomainSummary>;
};

export type HomeLoaderData = {
  /** Most-recent release-notes items, newest first (the newsletter feed) —
   * deferred (live in the real adapter) so the ticker shows a skeleton. */
  announcements: Promise<ReadonlyArray<HomeAnnouncement>>;
  /** Availability-derived stats — deferred (a live Confluence fetch + parse in
   * the real adapter); the hero stat numbers + domain index render a skeleton
   * until it resolves. */
  stats: Promise<HomeStats>;
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

/** Parallel doors, one per thing you might be trying to do. */
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
    title: "Find a service",
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
    title: "Check security policies",
    description: "Confirm what's required, and cite it, before you ship.",
    to: "/sources",
    lands: "Source registry",
  },
];

export const POPULAR: ReadonlyArray<string> = [
  "Deploy a service",
  "Data ingestion patterns",
  "Authentication flows",
  "Network setup",
];

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
    title: "Check security policies",
    links: [{ label: "Sources", to: "/sources" }],
  },
];
