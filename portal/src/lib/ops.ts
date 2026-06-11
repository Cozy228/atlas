/**
 * Operations snapshot fixtures for the `/proto/overview` prototypes.
 *
 * Entirely fictional and public-safe: invented application names, teams,
 * versions, and timestamps. There is no operations backend yet, so every
 * surface that renders this data must self-describe as a demo snapshot
 * (ship-state honesty — DESIGN.md §1.6). Timestamps are absolute strings on
 * purpose: a frozen snapshot, not a live feed.
 */

export type Env = "dev" | "staging" | "prod";

export const ENVS: ReadonlyArray<Env> = ["dev", "staging", "prod"];

export const ENV_LABEL: Record<Env, string> = {
  dev: "Dev",
  staging: "Staging",
  prod: "Prod",
};

/** When this fictional snapshot was taken; render wherever freshness is implied. */
export const SNAPSHOT_AT = "Jun 11, 2026 · 09:55 UTC";

export type ServiceHealth = "healthy" | "degraded" | "down";

export type AppService = {
  id: string;
  name: string;
  team: string;
  health: ServiceHealth;
  /** Trailing-90-day uptime, pre-formatted. */
  uptime: string;
  /** Trailing-1-hour error rate, pre-formatted. */
  errorRate: string;
  /** Trailing-1-hour p99 latency, pre-formatted. */
  p99: string;
  /** Version currently running in each environment. */
  versions: Record<Env, string>;
  lastDeploy: string;
};

export const APP_SERVICES: ReadonlyArray<AppService> = [
  {
    id: "atlas-portal",
    name: "Atlas Portal",
    team: "Platform Experience",
    health: "healthy",
    uptime: "99.99%",
    errorRate: "0.01%",
    p99: "184 ms",
    versions: { dev: "2026.6.11-rc.2", staging: "2026.6.10", prod: "2026.6.10" },
    lastDeploy: "Jun 11, 08:40",
  },
  {
    id: "identity-gateway",
    name: "Identity Gateway",
    team: "Identity & Access",
    health: "healthy",
    uptime: "99.99%",
    errorRate: "0.00%",
    p99: "96 ms",
    versions: { dev: "4.18.0", staging: "4.18.0", prod: "4.17.2" },
    lastDeploy: "Jun 10, 16:05",
  },
  {
    id: "billing-api",
    name: "Billing API",
    team: "Commerce",
    health: "degraded",
    uptime: "99.91%",
    errorRate: "1.84%",
    p99: "1.9 s",
    versions: { dev: "7.3.1", staging: "7.3.0", prod: "7.2.4" },
    lastDeploy: "Jun 11, 07:12",
  },
  {
    id: "checkout-web",
    name: "Checkout Web",
    team: "Commerce",
    health: "healthy",
    uptime: "99.97%",
    errorRate: "0.05%",
    p99: "310 ms",
    versions: { dev: "2026.6.11", staging: "2026.6.11", prod: "2026.6.09" },
    lastDeploy: "Jun 11, 09:18",
  },
  {
    id: "ingest-worker",
    name: "Ingest Worker",
    team: "Data Platform",
    health: "healthy",
    uptime: "99.95%",
    errorRate: "0.12%",
    p99: "2.4 s",
    versions: { dev: "1.42.0", staging: "1.41.3", prod: "1.41.3" },
    lastDeploy: "Jun 09, 11:30",
  },
  {
    id: "search-indexer",
    name: "Search Indexer",
    team: "Data Platform",
    health: "healthy",
    uptime: "99.98%",
    errorRate: "0.03%",
    p99: "640 ms",
    versions: { dev: "0.9.7", staging: "0.9.7", prod: "0.9.7" },
    lastDeploy: "Jun 08, 14:52",
  },
  {
    id: "notification-hub",
    name: "Notification Hub",
    team: "Platform Experience",
    health: "healthy",
    uptime: "99.96%",
    errorRate: "0.08%",
    p99: "220 ms",
    versions: { dev: "3.6.0-beta.1", staging: "3.5.2", prod: "3.5.2" },
    lastDeploy: "Jun 10, 10:21",
  },
  {
    id: "media-transcoder",
    name: "Media Transcoder",
    team: "Content Systems",
    health: "healthy",
    uptime: "99.93%",
    errorRate: "0.22%",
    p99: "4.1 s",
    versions: { dev: "5.1.0", staging: "5.1.0", prod: "5.0.6" },
    lastDeploy: "Jun 06, 17:44",
  },
];

export type DeployStatus = "success" | "failed" | "running" | "cancelled";

export type Deployment = {
  id: string;
  service: string;
  serviceId: string;
  env: Env;
  status: DeployStatus;
  /** Short commit-ish ref. */
  ref: string;
  message: string;
  duration: string;
  /** Absolute snapshot time. */
  at: string;
  actor: string;
};

export const DEPLOYMENTS: ReadonlyArray<Deployment> = [
  {
    id: "dep-1041",
    service: "Checkout Web",
    serviceId: "checkout-web",
    env: "staging",
    status: "running",
    ref: "9c41f2a",
    message: "Promote 2026.6.11: cart rounding fix and PSP retry budget",
    duration: "2m 18s",
    at: "Jun 11, 09:51",
    actor: "release-bot",
  },
  {
    id: "dep-1040",
    service: "Billing API",
    serviceId: "billing-api",
    env: "prod",
    status: "failed",
    ref: "b7e0c93",
    message: "Hotfix 7.2.5: invoice line-item dedupe on retry",
    duration: "6m 02s",
    at: "Jun 11, 09:24",
    actor: "m.okafor",
  },
  {
    id: "dep-1039",
    service: "Checkout Web",
    serviceId: "checkout-web",
    env: "dev",
    status: "success",
    ref: "9c41f2a",
    message: "Cart rounding fix and PSP retry budget",
    duration: "3m 41s",
    at: "Jun 11, 09:18",
    actor: "l.santos",
  },
  {
    id: "dep-1038",
    service: "Atlas Portal",
    serviceId: "atlas-portal",
    env: "dev",
    status: "success",
    ref: "f3a92c1",
    message: "2026.6.11-rc.2: availability map clustering",
    duration: "4m 12s",
    at: "Jun 11, 08:40",
    actor: "j.wei",
  },
  {
    id: "dep-1037",
    service: "Billing API",
    serviceId: "billing-api",
    env: "staging",
    status: "success",
    ref: "41d88aa",
    message: "7.3.0: usage-based proration engine behind flag",
    duration: "5m 47s",
    at: "Jun 11, 07:12",
    actor: "m.okafor",
  },
  {
    id: "dep-1036",
    service: "Identity Gateway",
    serviceId: "identity-gateway",
    env: "staging",
    status: "success",
    ref: "c19e44b",
    message: "4.18.0: WebAuthn step-up for admin scopes",
    duration: "2m 55s",
    at: "Jun 10, 16:05",
    actor: "release-bot",
  },
  {
    id: "dep-1035",
    service: "Notification Hub",
    serviceId: "notification-hub",
    env: "prod",
    status: "success",
    ref: "7a2d510",
    message: "3.5.2: digest batching window to 15 minutes",
    duration: "3m 09s",
    at: "Jun 10, 10:21",
    actor: "release-bot",
  },
  {
    id: "dep-1034",
    service: "Ingest Worker",
    serviceId: "ingest-worker",
    env: "prod",
    status: "success",
    ref: "e88f1b7",
    message: "1.41.3: backpressure tuning for burst topics",
    duration: "8m 33s",
    at: "Jun 09, 11:30",
    actor: "d.fontaine",
  },
  {
    id: "dep-1033",
    service: "Media Transcoder",
    serviceId: "media-transcoder",
    env: "staging",
    status: "cancelled",
    ref: "30cc7d2",
    message: "5.1.0: AV1 ladder rollout (superseded by 5.1.1 build)",
    duration: "1m 04s",
    at: "Jun 09, 09:02",
    actor: "p.virtanen",
  },
  {
    id: "dep-1032",
    service: "Search Indexer",
    serviceId: "search-indexer",
    env: "prod",
    status: "success",
    ref: "5b6e9f0",
    message: "0.9.7: shard-aware snapshot restore",
    duration: "7m 26s",
    at: "Jun 08, 14:52",
    actor: "release-bot",
  },
];

export type IncidentStatus = "investigating" | "monitoring" | "resolved";

export type Incident = {
  id: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  status: IncidentStatus;
  title: string;
  service: string;
  serviceId: string;
  startedAt: string;
  resolvedAt?: string;
  updates: ReadonlyArray<{ at: string; text: string }>;
};

export const INCIDENTS: ReadonlyArray<Incident> = [
  {
    id: "INC-2041",
    severity: "SEV-2",
    status: "monitoring",
    title: "Elevated invoice retries on Billing API",
    service: "Billing API",
    serviceId: "billing-api",
    startedAt: "Jun 11, 06:48",
    updates: [
      {
        at: "Jun 11, 09:30",
        text: "Retry storm contained by rate limit; error rate falling. Hotfix 7.2.5 failed CI and is being rebuilt.",
      },
      {
        at: "Jun 11, 07:55",
        text: "Root cause traced to duplicate line items on PSP retry. Mitigation: dedupe at ingest.",
      },
      { at: "Jun 11, 06:48", text: "Paging Commerce on-call; invoice error rate above 1.5%." },
    ],
  },
  {
    id: "INC-2040",
    severity: "SEV-3",
    status: "resolved",
    title: "Slow media previews in EU outposts",
    service: "Media Transcoder",
    serviceId: "media-transcoder",
    startedAt: "Jun 09, 13:10",
    resolvedAt: "Jun 09, 15:40",
    updates: [
      { at: "Jun 09, 15:40", text: "Cache warm-up complete; preview latency back under 800 ms." },
      { at: "Jun 09, 13:10", text: "Edge cache eviction after 5.0.6 rollout; previews regenerating." },
    ],
  },
  {
    id: "INC-2039",
    severity: "SEV-2",
    status: "resolved",
    title: "Login latency spike behind Identity Gateway",
    service: "Identity Gateway",
    serviceId: "identity-gateway",
    startedAt: "Jun 05, 08:20",
    resolvedAt: "Jun 05, 09:05",
    updates: [
      { at: "Jun 05, 09:05", text: "Connection pool resized; p99 back to baseline." },
      { at: "Jun 05, 08:20", text: "Token introspection pool exhausted under morning peak." },
    ],
  },
];

export type OpsAnnouncement = {
  kind: string;
  tone: "success" | "info" | "warning";
  title: string;
  description: string;
  date: string;
};

/** Platform announcements folded into the operations surface (Home links here). */
export const OPS_ANNOUNCEMENTS: ReadonlyArray<OpsAnnouncement> = [
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

/**
 * Trailing mini-series for the dashboard sparklines (fictional, unitless where
 * noted). Frozen with the snapshot; not a live feed.
 */
export const KPI_SPARKS = {
  /** Deploys per day, trailing 7 days. */
  deploysPerDay: [6, 9, 5, 11, 7, 8, 4],
  /** Prod error rate %, trailing 12 hours. */
  prodErrorRate: [0.04, 0.05, 0.03, 0.06, 0.21, 0.34, 0.18, 0.12, 0.09, 0.07, 0.05, 0.04],
  /** Fleet p99 latency (ms), trailing 12 hours. */
  p99Latency: [188, 180, 192, 214, 268, 430, 540, 360, 244, 212, 198, 190],
  /** Open incident count, trailing 12 hours. */
  openIncidents: [0, 0, 1, 1, 2, 2, 1, 1, 1, 1, 1, 1],
} as const;

/* -------------------------------------------------------------------------- */
/*  Derived helpers (plain functions over the fixtures)                       */
/* -------------------------------------------------------------------------- */

/** Deployments whose snapshot date matches the snapshot day (Jun 11). */
export function deploysToday(deployments: ReadonlyArray<Deployment> = DEPLOYMENTS): number {
  return deployments.filter((d) => d.at.startsWith("Jun 11")).length;
}

/** Count of deployments in each terminal/active status. */
export function deployStatusCounts(
  deployments: ReadonlyArray<Deployment> = DEPLOYMENTS,
): Record<DeployStatus, number> {
  const counts: Record<DeployStatus, number> = {
    success: 0,
    failed: 0,
    running: 0,
    cancelled: 0,
  };
  for (const d of deployments) counts[d.status] += 1;
  return counts;
}

export function healthSummary(services: ReadonlyArray<AppService> = APP_SERVICES): {
  healthy: number;
  degraded: number;
  down: number;
  total: number;
} {
  let healthy = 0;
  let degraded = 0;
  let down = 0;
  for (const service of services) {
    if (service.health === "healthy") healthy += 1;
    else if (service.health === "degraded") degraded += 1;
    else down += 1;
  }
  return { healthy, degraded, down, total: services.length };
}

export function openIncidents(incidents: ReadonlyArray<Incident> = INCIDENTS): ReadonlyArray<Incident> {
  return incidents.filter((incident) => incident.status !== "resolved");
}

/** Services whose dev or staging version is ahead of prod (pending promotion). */
export function pendingPromotions(
  services: ReadonlyArray<AppService> = APP_SERVICES,
): ReadonlyArray<AppService> {
  return services.filter(
    (service) =>
      service.versions.prod !== service.versions.staging ||
      service.versions.staging !== service.versions.dev,
  );
}

export type AttentionItem = {
  id: string;
  /** 0 = highest. */
  priority: number;
  tone: "critical" | "warning" | "info";
  kind: string;
  title: string;
  note: string;
  at: string;
};

/**
 * One priority-sorted feed of everything an operator should look at first:
 * open incidents, failed deploys, degraded services, then in-flight deploys.
 */
export function needsAttention(): ReadonlyArray<AttentionItem> {
  const items: AttentionItem[] = [];

  for (const inc of openIncidents()) {
    items.push({
      id: inc.id,
      priority: inc.severity === "SEV-1" ? 0 : 1,
      tone: inc.severity === "SEV-1" ? "critical" : "warning",
      kind: `${inc.severity} · ${inc.status}`,
      title: inc.title,
      note: inc.updates[0]?.text ?? "",
      at: inc.startedAt,
    });
  }
  for (const d of DEPLOYMENTS.filter((x) => x.status === "failed")) {
    items.push({
      id: d.id,
      priority: 1,
      tone: "critical",
      kind: "Deploy failed",
      title: `${d.service} → ${d.env}`,
      note: d.message,
      at: d.at,
    });
  }
  for (const s of APP_SERVICES.filter((x) => x.health === "degraded")) {
    items.push({
      id: `svc-${s.id}`,
      priority: 2,
      tone: "warning",
      kind: "Degraded",
      title: s.name,
      note: `Error rate ${s.errorRate} · p99 ${s.p99}`,
      at: s.lastDeploy,
    });
  }
  for (const d of DEPLOYMENTS.filter((x) => x.status === "running")) {
    items.push({
      id: d.id,
      priority: 3,
      tone: "info",
      kind: "Deploying",
      title: `${d.service} → ${d.env}`,
      note: d.message,
      at: d.at,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}
