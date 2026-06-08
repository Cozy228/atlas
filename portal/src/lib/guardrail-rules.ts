/**
 * Guardrail rules — generic local model with placeholder data.
 *
 * The schema/context API has no first-class rule entity yet; a company deployment
 * would serve these from a server API. Here they are a public-safe static map keyed
 * by guardrail (topic) id. Guardrails without an entry render no rules section.
 *
 * TODO: replace with a real `fetchGuardrailRules(id)` server function when the
 * rule entity lands in @atlas/schema + context-layer.
 */

export type RuleSeverity = "critical" | "high" | "medium";

/** Enforcement mode for a rule, not a per-run pass/fail result. */
export type RuleStatus = "enforced" | "monitor" | "disabled";

export type GuardrailRule = {
  id: string;
  title: string;
  description: string;
  severity: RuleSeverity;
  status: RuleStatus;
};

const RULES_BY_GUARDRAIL: Record<string, ReadonlyArray<GuardrailRule>> = {
  "s3-guardrails": [
    {
      id: "s3-block-public-access",
      title: "Block public access",
      description: "Account-level public access block must be enabled on every bucket.",
      severity: "critical",
      status: "enforced",
    },
    {
      id: "s3-default-encryption",
      title: "Default encryption at rest",
      description: "Buckets must enforce server-side encryption with a managed key.",
      severity: "high",
      status: "enforced",
    },
    {
      id: "s3-lifecycle-policy",
      title: "Lifecycle policy present",
      description: "Long-lived buckets should declare a retention or transition lifecycle rule.",
      severity: "medium",
      status: "monitor",
    },
  ],
  "iam-boundary": [
    {
      id: "iam-permission-boundary",
      title: "Permission boundary attached",
      description: "Workload roles must carry the standard permission boundary policy.",
      severity: "critical",
      status: "enforced",
    },
    {
      id: "iam-no-wildcard-admin",
      title: "No wildcard administrator",
      description: "Inline or attached policies must not grant `*:*` on all resources.",
      severity: "high",
      status: "enforced",
    },
  ],
  "private-networking": [
    {
      id: "net-no-public-ingress",
      title: "No unrestricted ingress",
      description: "Security groups must not allow 0.0.0.0/0 on administrative ports.",
      severity: "high",
      status: "enforced",
    },
    {
      id: "net-private-subnets",
      title: "Workloads in private subnets",
      description: "Compute should run in private subnets with egress through a managed gateway.",
      severity: "medium",
      status: "monitor",
    },
  ],
  "logging-monitoring": [
    {
      id: "log-trail-enabled",
      title: "Audit trail enabled",
      description: "A multi-region audit trail must be active and delivering to a central account.",
      severity: "high",
      status: "enforced",
    },
    {
      id: "log-retention",
      title: "Minimum log retention",
      description: "Log groups should retain entries for at least the policy minimum.",
      severity: "medium",
      status: "disabled",
    },
  ],
};

export function getGuardrailRules(guardrailId: string): ReadonlyArray<GuardrailRule> {
  return RULES_BY_GUARDRAIL[guardrailId] ?? [];
}
