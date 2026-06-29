/**
 * Source category metadata for the `/sources` by-class view — a finer second
 * grouping axis (Networking / Runbooks / Privacy & Data …) beneath the 3-class
 * register. Static, public-safe category→slug mapping; it carries NO source
 * records, so it never pulls synthetic fixture data into the bundle. A source the
 * mapping does not recognise gracefully collapses to its source class.
 */
import type { Source } from "@atlas/schema";

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

/** The finer category a source belongs to (falls back to its class). */
export function sourceCategory(source: Source): string {
  return SLUG_TO_CATEGORY.get(source.id) ?? source.source_class;
}
