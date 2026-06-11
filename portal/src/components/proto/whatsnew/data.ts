/**
 * PROTOTYPE (production candidate) — fixtures for `/proto/whatsnew`.
 *
 * A platform changelog rendered as a broadsheet: releases, policy changes,
 * capability additions, deprecations, and resolved incidents, newest first.
 * Fictional and public-safe. Home's "What changed" section links here; the
 * three Home announcements are the most recent slice of this feed.
 */
import type { ProtoRoute } from "@/components/proto/home/data";

export type ChangeKind = "New" | "Updated" | "Policy" | "Deprecated" | "Incident";

export type ChangeTone = "success" | "info" | "warning" | "critical";

export type Change = {
  id: string;
  /** Display date, e.g. "Jun 4, 2026". */
  date: string;
  /** Sort key (newest first), e.g. "2026-06-04". */
  iso: string;
  /** Month bucket label, e.g. "June 2026". */
  month: string;
  kind: ChangeKind;
  tone: ChangeTone;
  title: string;
  summary: string;
  link?: { label: string; to: ProtoRoute };
};

export const KIND_TONE: Record<ChangeKind, ChangeTone> = {
  New: "success",
  Updated: "info",
  Policy: "warning",
  Deprecated: "critical",
  Incident: "info",
};

export const TONE_DOT: Record<ChangeTone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  critical: "bg-critical",
};

export const CHANGES: ReadonlyArray<Change> = [
  {
    id: "object-storage-ga",
    date: "Jun 9, 2026",
    iso: "2026-06-09",
    month: "June 2026",
    kind: "Deprecated",
    tone: "critical",
    title: "Legacy single-region pipeline template retired",
    summary:
      "The single-region deployment template is no longer offered. Existing services keep running; new pipelines use the dev → staging → prod template.",
    link: { label: "Connect a pipeline", to: "/proto/guidance" },
  },
  {
    id: "eu-west-latency",
    date: "Jun 7, 2026",
    iso: "2026-06-07",
    month: "June 2026",
    kind: "Incident",
    tone: "info",
    title: "Resolved: elevated latency in EU-West provisioning",
    summary:
      "Provisioning requests in EU-West queued for up to nine minutes between 09:10 and 10:40 UTC. A capacity rebalance cleared the backlog; no requests were dropped.",
    link: { label: "Operations overview", to: "/proto/overview" },
  },
  {
    id: "guardrail-cites",
    date: "Jun 5, 2026",
    iso: "2026-06-05",
    month: "June 2026",
    kind: "Updated",
    tone: "info",
    title: "Guardrail Check now cites each rule's policy source",
    summary:
      "Every rule result prints the policy it enforces, so a failing check links straight to the authority behind it.",
    link: { label: "Guardrail Check", to: "/proto/skills" },
  },
  {
    id: "object-storage-new",
    date: "Jun 4, 2026",
    iso: "2026-06-04",
    month: "June 2026",
    kind: "New",
    tone: "success",
    title: "Object Storage (S3-compatible) is generally available",
    summary:
      "Available in US-East-1 and DC16 with versioning and lifecycle rules. Added to the catalog under the Storage domain.",
    link: { label: "View in catalog", to: "/proto/catalog" },
  },
  {
    id: "gdc-approval",
    date: "Jun 2, 2026",
    iso: "2026-06-02",
    month: "June 2026",
    kind: "Policy",
    tone: "warning",
    title: "Two-step approval now required for GDC deployments",
    summary:
      "All GDC landing-zone deployments need a second approver from the owning team. The readiness checklist reflects the new gate.",
    link: { label: "Read the policy", to: "/proto/sources" },
  },
  {
    id: "k8s-authority",
    date: "May 28, 2026",
    iso: "2026-05-28",
    month: "May 2026",
    kind: "Updated",
    tone: "info",
    title: "Kubernetes Platform authority source raised to L1",
    summary:
      "The authority source was refreshed from the platform CMDB; its level is now L1, so guidance citing it no longer carries a freshness warning.",
    link: { label: "Source registry", to: "/proto/sources" },
  },
  {
    id: "pipeline-guidance",
    date: "May 20, 2026",
    iso: "2026-05-20",
    month: "May 2026",
    kind: "New",
    tone: "success",
    title: "Guidance published: Connect a Deployment Pipeline",
    summary:
      "A five-step walkthrough that wires an onboarded service to the approved CI/CD path, from template choice to the first promoted deploy.",
    link: { label: "Open the route", to: "/proto/guidance" },
  },
  {
    id: "iam-v3",
    date: "May 12, 2026",
    iso: "2026-05-12",
    month: "May 2026",
    kind: "Policy",
    tone: "warning",
    title: "IAM boundary policy v3 in effect",
    summary:
      "Wildcard administrative policies are now rejected at review. The security review gate checks for them before sign-off.",
    link: { label: "Security review gate", to: "/proto/guidance" },
  },
  {
    id: "document-store",
    date: "May 6, 2026",
    iso: "2026-05-06",
    month: "May 2026",
    kind: "New",
    tone: "success",
    title: "Managed Document store added to the catalog",
    summary:
      "A managed document database for flexible-schema workloads, available alongside the managed relational and cache options.",
    link: { label: "Choose a data store", to: "/proto/guidance" },
  },
];

/** Distinct month buckets in feed order (newest first). */
export function changeMonths(): ReadonlyArray<{ month: string; items: ReadonlyArray<Change> }> {
  const order: string[] = [];
  const byMonth = new Map<string, Change[]>();
  for (const change of CHANGES) {
    if (!byMonth.has(change.month)) {
      byMonth.set(change.month, []);
      order.push(change.month);
    }
    byMonth.get(change.month)!.push(change);
  }
  return order.map((month) => ({ month, items: byMonth.get(month)! }));
}

/** Count of entries per kind, in display order. */
export function kindCounts(): ReadonlyArray<{ kind: ChangeKind; count: number }> {
  const kinds: ChangeKind[] = ["New", "Updated", "Policy", "Deprecated", "Incident"];
  return kinds
    .map((kind) => ({ kind, count: CHANGES.filter((c) => c.kind === kind).length }))
    .filter((entry) => entry.count > 0);
}

/** Anchor id for a month section, e.g. "month-june-2026". */
export function monthAnchor(month: string): string {
  return `month-${month.toLowerCase().replace(/\s+/g, "-")}`;
}
