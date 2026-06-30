/**
 * Skills registry — local static data for the /skills page and the
 * `/proto/skills` prototypes.
 *
 * Public-safe placeholder content: fictional skill names and a generic install
 * command shape. A company deployment would back this with a real registry; the
 * page treats it as a plain static array (no API, loading, or error states).
 * The richer fields (stage, maintainer, whatItDoes, changelog) feed the proto
 * directions; the mainline page reads only the original subset.
 */

/** Where in the idea→production lifecycle a skill earns its keep. */
export type SkillStage = "scaffold" | "onboard" | "validate" | "rollout" | "context";

export type SkillChange = {
  version: string;
  date: string;
  note: string;
};

export type Skill = {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: ReadonlyArray<string>;
  stage: SkillStage;
  maintainer: string;
  updatedAt: string;
  /** What running the skill actually does, as concrete steps. */
  whatItDoes: ReadonlyArray<string>;
  changelog: ReadonlyArray<SkillChange>;
};

export const SKILL_STAGES: ReadonlyArray<{ id: SkillStage; label: string; description: string }> = [
  { id: "scaffold", label: "Scaffold", description: "Start a workspace the approved way." },
  { id: "onboard", label: "Onboard", description: "Register a service and its ownership." },
  { id: "validate", label: "Validate", description: "Check work against platform rules." },
  { id: "rollout", label: "Roll out", description: "Promote changes across regions." },
  { id: "context", label: "Context", description: "Package platform knowledge for agents." },
];

export const SKILLS: ReadonlyArray<Skill> = [
  {
    id: "terraform-baseline",
    name: "Terraform Baseline",
    description:
      "Scaffolds a compliant Terraform workspace with remote state, tagging policy, and pre-wired CI checks.",
    version: "2.4.0",
    tags: ["terraform", "scaffold", "ci"],
    stage: "scaffold",
    maintainer: "Cloud Platform",
    updatedAt: "2026-05-28",
    whatItDoes: [
      "Generates a Terraform workspace with the approved remote-state backend and provider pins.",
      "Applies the platform tagging policy module and a hardened .gitignore.",
      "Wires plan/apply CI checks (fmt, validate, guardrail dry-run) into the repo pipeline.",
    ],
    changelog: [
      { version: "2.4.0", date: "2026-05-28", note: "Provider pins refreshed; tagging module v3." },
      { version: "2.3.1", date: "2026-04-02", note: "Fixed remote-state init on existing repos." },
      { version: "2.3.0", date: "2026-02-19", note: "Added guardrail dry-run CI step." },
    ],
  },
  {
    id: "service-onboarding",
    name: "Service Onboarding",
    description:
      "Walks a new service through registry entry, ownership metadata, and default guardrail subscriptions.",
    version: "1.9.1",
    tags: ["onboarding", "catalog"],
    stage: "onboard",
    maintainer: "Platform Experience",
    updatedAt: "2026-06-02",
    whatItDoes: [
      "Creates the service's registry entry with owner team and support channel.",
      "Subscribes the service to the default guardrail set for its landing zone.",
      "Opens the access-request checklist for the selected landing zone.",
    ],
    changelog: [
      { version: "1.9.1", date: "2026-06-02", note: "Registry entry now validates owner team." },
      { version: "1.9.0", date: "2026-05-12", note: "Added GDC landing-zone subscription set." },
    ],
  },
  {
    id: "evidence-linter",
    name: "Evidence Linter",
    description:
      "Validates source anchors and flags stale or broken citations before they reach a context bundle.",
    version: "0.8.3",
    tags: ["evidence", "lint", "quality"],
    stage: "validate",
    maintainer: "Knowledge Systems",
    updatedAt: "2026-05-15",
    whatItDoes: [
      "Resolves every source anchor in the target bundle and verifies it still exists.",
      "Flags citations past their review window as stale, with the owning team.",
      "Fails CI when a claim cites a source below the required authority level.",
    ],
    changelog: [
      { version: "0.8.3", date: "2026-05-15", note: "Anchor resolver handles renamed headings." },
      { version: "0.8.2", date: "2026-04-21", note: "Stale window read from registry metadata." },
    ],
  },
  {
    id: "guardrail-check",
    name: "Guardrail Check",
    description:
      "Runs the active guardrail rule set against a plan and reports each rule's pass, warn, or fail status.",
    version: "3.1.0",
    tags: ["guardrails", "security", "policy"],
    stage: "validate",
    maintainer: "Security Engineering",
    updatedAt: "2026-06-05",
    whatItDoes: [
      "Evaluates the workspace plan against the guardrail rules active for its zone.",
      "Prints one line per rule: pass, warn, or fail, with the rule's source citation.",
      "Exits non-zero on fail so pipelines can gate promotion.",
    ],
    changelog: [
      { version: "3.1.0", date: "2026-06-05", note: "Rule results now cite their policy source." },
      { version: "3.0.2", date: "2026-05-07", note: "Faster evaluation on large plans." },
      { version: "3.0.0", date: "2026-03-30", note: "Rule set loaded from the live registry." },
    ],
  },
  {
    id: "region-rollout",
    name: "Region Rollout",
    description:
      "Generates a phased availability plan for promoting a service across regions with sign-off gates.",
    version: "1.2.0",
    tags: ["availability", "rollout"],
    stage: "rollout",
    maintainer: "Platform Operations",
    updatedAt: "2026-04-18",
    whatItDoes: [
      "Reads the service's current regional availability.",
      "Generates a phased promotion plan (wave order, ETAs, sign-off owners).",
      "Emits the plan as a reviewable file for the availability map to track.",
    ],
    changelog: [
      { version: "1.2.0", date: "2026-04-18", note: "Outpost waves planned after region waves." },
      { version: "1.1.0", date: "2026-02-26", note: "Sign-off owners pulled from registry." },
    ],
  },
  {
    id: "context-snapshot",
    name: "Context Snapshot",
    description:
      "Exports a portable context bundle for a topic so an agent can reason offline against frozen sources.",
    version: "0.5.6",
    tags: ["context", "export", "agent"],
    stage: "context",
    maintainer: "Knowledge Systems",
    updatedAt: "2026-05-30",
    whatItDoes: [
      "Assembles the topic's context bundle: sources, excerpts, and freshness warnings.",
      "Freezes the bundle with a content digest so agents can verify integrity offline.",
      "Writes a portable archive consumable by the agent toolchain.",
    ],
    changelog: [
      { version: "0.5.6", date: "2026-05-30", note: "Digest format aligned with skill index." },
      { version: "0.5.5", date: "2026-05-02", note: "Excerpt windows configurable per source." },
    ],
  },
];

export function getSkill(id: string): Skill | undefined {
  return SKILLS.find((skill) => skill.id === id);
}

export function skillsByStage(): ReadonlyArray<{
  stage: (typeof SKILL_STAGES)[number];
  items: ReadonlyArray<Skill>;
}> {
  return SKILL_STAGES.map((stage) => ({
    stage,
    items: SKILLS.filter((skill) => skill.stage === stage.id),
  })).filter((group) => group.items.length > 0);
}

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

/** Single-line run command for usage examples. */
export function skillRunCommand(skillId: string): string {
  return `${SKILL_RUNNER} ${SKILL_TOOL} run ${skillId}`;
}

/** A pipeline step that runs the skill in CI (fictional, public-safe action). */
export function skillCiSnippet(skillId: string): string {
  return [
    "- uses: atlas/skills-action@v1",
    "  with:",
    `    skill: ${skillId}`,
    "    registry: public",
  ].join("\n");
}

/** What a skill expects in the workspace before it can run. */
export const SKILL_REQUIREMENTS = "Node 18+ runner · public registry access" as const;
