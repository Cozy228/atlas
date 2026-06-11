/**
 * PROTOTYPE (production candidate) — shared fixtures for the `/proto/home`
 * directions. Fictional and public-safe; the loader-fed numbers (services,
 * domains, regions) come from the real availability projection instead.
 */

import type { Icon } from "@tabler/icons-react";
import {
  IconActivityHeartbeat,
  IconRocket,
  IconShieldCheck,
  IconSitemap,
  IconStack2,
} from "@tabler/icons-react";

/** Targets inside the prototype suite (plus the pages that have no proto yet). */
export type ProtoRoute =
  | "/proto/home"
  | "/proto/catalog"
  | "/proto/capability"
  | "/proto/guidance"
  | "/proto/skills"
  | "/proto/sources"
  | "/proto/overview"
  | "/proto/whatsnew"
  | "/proto/ask"
  | "/regions";

export type DomainSummary = {
  domain: string;
  /** Anchor id of the matching domain shelf on `/proto/catalog`. */
  anchor: string;
  count: number;
  /** First few service names, pre-joined for a one-line preview. */
  preview: string;
};

export type HomeLoaderData = {
  serviceCount: number;
  domainCount: number;
  regionCount: number;
  domains: ReadonlyArray<DomainSummary>;
};

export type IntentExample = { label: string; to: ProtoRoute };

export type Intent = {
  title: string;
  description: string;
  to: ProtoRoute;
  icon: Icon;
  /** Where the door lands, in one phrase (trailing hint). */
  lands: string;
  /** Concrete entry points; the featured door surfaces these. */
  examples?: ReadonlyArray<IntentExample>;
};

/** Ordered by frequency; the first is the page's featured door. */
export const INTENTS: ReadonlyArray<Intent> = [
  {
    title: "Start a new service",
    description: "Stand up a new workload the approved way, from access to first deploy.",
    to: "/proto/guidance",
    icon: IconRocket,
    lands: "Guidance routes",
    examples: [
      { label: "New app onboarding", to: "/proto/guidance" },
      { label: "Connect a pipeline", to: "/proto/guidance" },
    ],
  },
  {
    title: "Find a capability",
    description: "Browse what the platform offers, grouped by the domain it lives in.",
    to: "/proto/catalog",
    icon: IconStack2,
    lands: "Service catalog",
  },
  {
    title: "Make a platform decision",
    description: "Branch through the approved options and leave with a defensible choice.",
    to: "/proto/guidance",
    icon: IconSitemap,
    lands: "Decision routes",
  },
  {
    title: "Check policy and guardrails",
    description: "Confirm what's required, and cite it, before you ship.",
    to: "/proto/sources",
    icon: IconShieldCheck,
    lands: "Source registry",
  },
  {
    title: "See platform health",
    description: "Deployments, service health, and open incidents as they stand now.",
    to: "/proto/overview",
    icon: IconActivityHeartbeat,
    lands: "Operations overview",
  },
];

export const POPULAR: ReadonlyArray<string> = [
  "Deploy a service",
  "Data ingestion patterns",
  "Authentication flows",
  "Network setup",
];

export type RecentItem = { name: string; type: string; to: ProtoRoute };

export const RECENTS: ReadonlyArray<RecentItem> = [
  { name: "Object Storage", type: "Capability", to: "/proto/capability" },
  { name: "GDC Foundation", type: "Landing zone", to: "/proto/catalog" },
  { name: "Service authentication flow", type: "Guide", to: "/proto/guidance" },
  { name: "RBAC policy templates", type: "Policy", to: "/proto/sources" },
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
  links: ReadonlyArray<{ label: string; to: ProtoRoute }>;
};

export const LIFECYCLE: ReadonlyArray<LifecyclePhase> = [
  {
    phase: "Get started",
    title: "Understand the catalog",
    links: [
      { label: "Service catalog", to: "/proto/catalog" },
      { label: "Availability map", to: "/regions" },
    ],
  },
  {
    phase: "Build",
    title: "Provision and configure",
    links: [{ label: "Guidance", to: "/proto/guidance" }],
  },
  {
    phase: "Validate",
    title: "Check guardrails",
    links: [{ label: "Sources", to: "/proto/sources" }],
  },
  {
    phase: "Operate",
    title: "Monitor and evolve",
    links: [{ label: "Operations overview", to: "/proto/overview" }],
  },
];
