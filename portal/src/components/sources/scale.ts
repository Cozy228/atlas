/**
 * Dev density fixture — synthetic source set for stress-testing the
 * "By class" direction at realistic volume.
 *
 * The real discovery projection only carries a handful of sources, which hides
 * how the grouped-by-class layout behaves once a class holds dozens of entries.
 * This module generates ~50 fictional, public-safe sources spread across the
 * three classes so the layout can be reviewed at scale. It is wired ONLY into
 * the `byclass` variant; the `ledger` default keeps reading real data.
 *
 * Everything here is fictional. No company names, ids, or locations.
 */
import type { AuthorityLevel, Source, Visibility } from "@atlas/schema";

type ClassSeed = {
  cls: Source["source_class"];
  idPrefix: string;
  /** Steward pool — cycled per item so "group by steward" has real spread. */
  stewards: ReadonlyArray<string>;
  /** [title, slug] pairs — slug feeds the source id. */
  items: ReadonlyArray<readonly [string, string]>;
};

const AUTHORITY_CYCLE: ReadonlyArray<AuthorityLevel> = [
  "authoritative",
  "authoritative",
  "reference",
  "reference",
  "example",
  "draft",
  "deprecated",
];

/** Fixed review anchors (today ≈ 2026-06-12) so freshness varies deterministically. */
const REVIEWED_CYCLE: ReadonlyArray<string> = [
  "2026-05-20T00:00:00.000Z", // current
  "2026-04-02T00:00:00.000Z", // current / edge
  "2026-03-01T00:00:00.000Z", // needs-review under P90D
  "2026-01-15T00:00:00.000Z", // stale under P90D
  "2025-11-10T00:00:00.000Z", // stale
];

const FREQUENCY_CYCLE: ReadonlyArray<string> = ["P90D", "P120D", "P30D", "P180D"];

const SEEDS: ReadonlyArray<ClassSeed> = [
  {
    cls: "terraform-module",
    idPrefix: "tf",
    stewards: ["platform-infra", "network-core", "data-infra"],
    items: [
      ["VPC Landing Zone", "vpc-landing-zone"],
      ["EKS Baseline Cluster", "eks-baseline"],
      ["RDS PostgreSQL", "rds-postgres"],
      ["Secure S3 Bucket", "s3-secure-bucket"],
      ["Application Load Balancer", "alb-ingress"],
      ["Serverless Function", "lambda-function"],
      ["DynamoDB Table", "dynamodb-table"],
      ["SQS Queue", "sqs-queue"],
      ["SNS Topic", "sns-topic"],
      ["CloudFront Distribution", "cloudfront-cdn"],
      ["Route 53 Zone", "route53-zone"],
      ["KMS Key Ring", "kms-key-ring"],
      ["Secrets Manager", "secrets-manager"],
      ["IAM Role Factory", "iam-role-factory"],
      ["VPC Peering", "vpc-peering"],
      ["Transit Gateway", "transit-gateway"],
      ["ECR Registry", "ecr-registry"],
      ["ElastiCache Redis", "elasticache-redis"],
      ["OpenSearch Domain", "opensearch-domain"],
      ["Step Functions", "step-functions"],
      ["EventBridge Bus", "eventbridge-bus"],
      ["WAF Web ACL", "waf-web-acl"],
    ],
  },
  {
    cls: "confluence-page",
    idPrefix: "conf",
    stewards: ["developer-experience", "sre-oncall", "docs-guild"],
    items: [
      ["Onboarding Runbook", "onboarding-runbook"],
      ["Incident Response Guide", "incident-response"],
      ["Service Catalog Overview", "service-catalog-overview"],
      ["Deployment Checklist", "deployment-checklist"],
      ["On-Call Handbook", "on-call-handbook"],
      ["Architecture Decision Log", "architecture-decisions"],
      ["Local Dev Setup", "local-dev-setup"],
      ["Release Process", "release-process"],
      ["Cost Optimization Tips", "cost-optimization"],
      ["Logging Conventions", "logging-conventions"],
      ["Naming Standards", "naming-standards"],
      ["Tagging Guide", "tagging-guide"],
      ["Disaster Recovery Plan", "disaster-recovery"],
      ["SLO Definitions", "slo-definitions"],
      ["Glossary of Terms", "glossary"],
      ["FAQ for New Teams", "new-team-faq"],
      ["Support Escalation Paths", "support-escalation"],
      ["Migration Playbook", "migration-playbook"],
    ],
  },
  {
    cls: "policy-document",
    idPrefix: "pol",
    stewards: ["governance-office", "security-eng", "privacy-office"],
    items: [
      ["Data Classification Policy", "data-classification"],
      ["Access Control Standard", "access-control"],
      ["Encryption Requirements", "encryption-requirements"],
      ["Retention Schedule", "retention-schedule"],
      ["Acceptable Use Policy", "acceptable-use"],
      ["Change Management Policy", "change-management"],
      ["Vendor Risk Standard", "vendor-risk"],
      ["Network Segmentation Rule", "network-segmentation"],
      ["Backup Policy", "backup-policy"],
      ["Privacy Standard", "privacy-standard"],
      ["Audit Logging Mandate", "audit-logging"],
      ["Key Rotation Policy", "key-rotation"],
      ["Incident Disclosure Rule", "incident-disclosure"],
      ["Third-Party Sharing Policy", "third-party-sharing"],
    ],
  },
];

/**
 * Finer sub-classification within each class. The coarse 3-class axis is too
 * broad once a class holds 20+ rows; these categories give the by-class view a
 * second, finer grouping axis (Networking / Runbooks / Privacy & Data …).
 * Ordered by class; every slug above is covered exactly once.
 */
const CATEGORY_GROUPS: ReadonlyArray<readonly [string, ReadonlyArray<string>]> = [
  // terraform-module
  [
    "Networking",
    [
      "vpc-landing-zone",
      "alb-ingress",
      "route53-zone",
      "vpc-peering",
      "transit-gateway",
      "cloudfront-cdn",
      "waf-web-acl",
    ],
  ],
  ["Compute & Runtime", ["eks-baseline", "lambda-function", "ecr-registry", "step-functions"]],
  [
    "Storage & Data",
    [
      "s3-secure-bucket",
      "rds-postgres",
      "dynamodb-table",
      "elasticache-redis",
      "opensearch-domain",
    ],
  ],
  ["Messaging", ["sqs-queue", "sns-topic", "eventbridge-bus"]],
  ["Security & IAM", ["kms-key-ring", "secrets-manager", "iam-role-factory"]],
  // confluence-page
  [
    "Runbooks",
    [
      "onboarding-runbook",
      "incident-response",
      "on-call-handbook",
      "disaster-recovery",
      "migration-playbook",
    ],
  ],
  [
    "How-to Guides",
    [
      "local-dev-setup",
      "release-process",
      "cost-optimization",
      "support-escalation",
      "new-team-faq",
    ],
  ],
  ["Standards", ["logging-conventions", "naming-standards", "tagging-guide", "slo-definitions"]],
  [
    "Reference",
    ["service-catalog-overview", "deployment-checklist", "architecture-decisions", "glossary"],
  ],
  // policy-document
  [
    "Security Policy",
    ["access-control", "encryption-requirements", "network-segmentation", "key-rotation"],
  ],
  [
    "Privacy & Data",
    ["data-classification", "privacy-standard", "retention-schedule", "third-party-sharing"],
  ],
  [
    "Governance",
    [
      "acceptable-use",
      "change-management",
      "vendor-risk",
      "audit-logging",
      "incident-disclosure",
      "backup-policy",
    ],
  ],
];

/** Category display order, finer than the 3-class axis. */
export const CATEGORY_ORDER: ReadonlyArray<string> = CATEGORY_GROUPS.map(([name]) => name);

const SLUG_TO_CATEGORY = new Map<string, string>(
  CATEGORY_GROUPS.flatMap(([name, slugs]) => slugs.map((s) => [s, name] as const)),
);

const CATEGORY_BY_ID = new Map<string, string>();

/** The finer category a scaled source belongs to (falls back to its class). */
export function sourceCategory(source: Source): string {
  return CATEGORY_BY_ID.get(source.id) ?? source.source_class;
}

function buildSource(seed: ClassSeed, title: string, slug: string, index: number): Source {
  const authority = AUTHORITY_CYCLE[index % AUTHORITY_CYCLE.length]!;
  const reviewed = REVIEWED_CYCLE[index % REVIEWED_CYCLE.length]!;
  const frequency = FREQUENCY_CYCLE[index % FREQUENCY_CYCLE.length]!;
  // Every 6th policy/confluence source is restricted; modules stay internal.
  const visibility: Visibility =
    seed.cls !== "terraform-module" && index % 6 === 4 ? "restricted" : "internal";
  const id = `${seed.idPrefix}-${slug}`;
  const category = SLUG_TO_CATEGORY.get(slug);
  if (category) CATEGORY_BY_ID.set(id, category);
  return {
    id,
    title,
    source_class: seed.cls,
    location: `https://example.internal/${seed.idPrefix}/${slug}`,
    steward: seed.stewards[index % seed.stewards.length]!,
    visibility,
    authority_scope: [seed.cls],
    authority_level: authority,
    last_observed_at: reviewed,
    last_reviewed_at: reviewed,
    review_frequency: frequency,
  };
}

/** ~54 fictional sources spread across the three classes for scale review. */
export const SCALE_SOURCES: ReadonlyArray<Source> = SEEDS.flatMap((seed) =>
  seed.items.map(([title, slug], i) => buildSource(seed, title, slug, i)),
);
