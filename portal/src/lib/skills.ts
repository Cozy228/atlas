/**
 * Skills registry — local static data for the /skills page.
 *
 * Public-safe placeholder content: fictional skill names and a generic install
 * command shape. A company deployment would back this with a real registry; the
 * page treats it as a plain static array (no API, loading, or error states).
 */

export type Skill = {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: ReadonlyArray<string>;
};

export const SKILLS: ReadonlyArray<Skill> = [
  {
    id: "terraform-baseline",
    name: "Terraform Baseline",
    description:
      "Scaffolds a compliant Terraform workspace with remote state, tagging policy, and pre-wired CI checks.",
    version: "2.4.0",
    tags: ["terraform", "scaffold", "ci"],
  },
  {
    id: "service-onboarding",
    name: "Service Onboarding",
    description:
      "Walks a new service through registry entry, ownership metadata, and default guardrail subscriptions.",
    version: "1.9.1",
    tags: ["onboarding", "catalog"],
  },
  {
    id: "evidence-linter",
    name: "Evidence Linter",
    description:
      "Validates source anchors and flags stale or broken citations before they reach a context bundle.",
    version: "0.8.3",
    tags: ["evidence", "lint", "quality"],
  },
  {
    id: "guardrail-check",
    name: "Guardrail Check",
    description:
      "Runs the active guardrail rule set against a plan and reports each rule's pass, warn, or fail status.",
    version: "3.1.0",
    tags: ["guardrails", "security", "policy"],
  },
  {
    id: "region-rollout",
    name: "Region Rollout",
    description:
      "Generates a phased availability plan for promoting a capability across regions with sign-off gates.",
    version: "1.2.0",
    tags: ["availability", "rollout"],
  },
  {
    id: "context-snapshot",
    name: "Context Snapshot",
    description:
      "Exports a portable context bundle for a topic so an agent can reason offline against frozen sources.",
    version: "0.5.6",
    tags: ["context", "export", "agent"],
  },
];

const SKILL_RUNNER = "npx";
const SKILL_TOOL = "@atlas/skills";
const SKILL_ORIGIN = "--registry public";

/** Single-line install command: `<runner> <tool> <action> <origin> <option> <skill-id>`. */
export function skillInstallCommand(skillId: string): string {
  return `${SKILL_RUNNER} ${SKILL_TOOL} add ${SKILL_ORIGIN} --yes ${skillId}`;
}

/** Single-line list command: `<runner> <tool> <list-action> <origin>`. */
export function skillListCommand(): string {
  return `${SKILL_RUNNER} ${SKILL_TOOL} list ${SKILL_ORIGIN}`;
}
