/**
 * Rules-only kernel (plan 018): `SECTION_RULES` is the per-kind section→source
 * projection policy the resource-derivation engine applies. It is the normative
 * "which discovered source backs which section, and where in it" rule — never a
 * discovered instance, so it lives in the kernel, not `data/`.
 *
 * A rule names the source CLASS the section binds to (`from`) and, for a
 * heading-located source (the Terraform module README), a default
 * `headingPattern` used to find the section's entry heading by raw-TOC scan
 * (anchor "3 去"). A section with no rule for a kind has no derivation source →
 * honest-gap (omitted, never an empty section).
 *
 * Only `service` is populated in this task; `guardrail` / `landing-zone` get
 * their own rules when their discovery spaces land (each has its own source-
 * system space — the unit taxonomy is discovered, not curated).
 */
import type { ResourceKind, SectionId } from "@atlas/schema";

/**
 * A per-section derivation rule.
 *  - `terraform-module`: located in the module README by the first heading whose
 *    text matches `headingPattern` (heading-pattern default + raw-TOC).
 *  - `availability-matrix`: bound to the synthetic availability source by a
 *    `{ service }` selector — every service, no heading.
 *  - `policy-document`: located in a security-policy Confluence page by the first
 *    heading whose text matches `headingPattern` — the guardrail analog of the
 *    `terraform-module` rule (heading-pattern default + storage-HTML TOC).
 */
export type SectionRule =
  | { from: "terraform-module"; headingPattern: RegExp }
  | { from: "availability-matrix" }
  | { from: "policy-document"; headingPattern: RegExp };

export const SECTION_RULES: Record<ResourceKind, Partial<Record<SectionId, SectionRule>>> = {
  service: {
    network: {
      from: "terraform-module",
      headingPattern: /\b(private|subnet|network|connectiv|vpc|endpoint|peering)\b/i,
    },
    examples: {
      from: "terraform-module",
      headingPattern: /\b(starter|example|quickstart|getting started|usage)\b/i,
    },
    availability: { from: "availability-matrix" },
  },
  guardrail: {
    "enforced-controls": {
      from: "policy-document",
      headingPattern:
        /\b(enforced|control|require|public access|baseline|encryption|standard|mandatory)\b/i,
    },
    exceptions: {
      from: "policy-document",
      headingPattern: /\b(exception|legacy|allowance|waiver|deprecated)\b/i,
    },
  },
  "landing-zone": {},
};
