/**
 * PROTOTYPE (scale fixture) — synthetic skills for stress-testing the
 * `/proto/skills` directions (Tool shelf + Man pages) at realistic volume.
 *
 * The shared `lib/skills` registry carries only the curated subset, which hides
 * how the stage rail, marketplace rows, and apropos index behave once each
 * stage holds many skills. This module keeps the real skills (so their detail
 * pages stay intact) and appends ~36 fictional, public-safe ones, then exposes
 * a `getProtoSkill` lookup the proto detail route resolves through — the same
 * pattern as `getProtoGuidance`. Nothing here touches the mainline `/skills`.
 */
import { SKILLS, type Skill, type SkillStage } from "@/lib/skills";

type Seed = readonly [name: string, slug: string, blurb: string, tags: string];

const SEEDS: ReadonlyArray<readonly [SkillStage, string, ReadonlyArray<Seed>]> = [
  [
    "scaffold",
    "Cloud Platform",
    [
      ["Service Skeleton", "service-skeleton", "Generates a service repo with the approved layout and CI.", "scaffold ci repo"],
      ["Container Baseline", "container-baseline", "Scaffolds a hardened Dockerfile and build pipeline.", "docker build"],
      ["Helm Chart Starter", "helm-chart-starter", "Lays down a chart wired to the platform values.", "helm k8s"],
      ["Lambda Scaffold", "lambda-scaffold", "Bootstraps a serverless function with tracing on.", "serverless"],
      ["API Spec Init", "api-spec-init", "Seeds an OpenAPI spec and contract tests.", "api openapi"],
      ["Frontend App Init", "frontend-app-init", "Scaffolds an SPA with the design system pre-wired.", "frontend ui"],
      ["Data Pipeline Init", "data-pipeline-init", "Generates a batch pipeline with schema checks.", "data etl"],
    ],
  ],
  [
    "onboard",
    "Platform Experience",
    [
      ["Catalog Register", "catalog-register", "Registers a service and its ownership metadata.", "catalog onboard"],
      ["Ownership Sync", "ownership-sync", "Reconciles team ownership against the directory.", "ownership"],
      ["Cost Center Tag", "cost-center-tag", "Attaches billing tags and a budget alert.", "cost billing"],
      ["On-Call Wire-Up", "oncall-wireup", "Connects a service to its escalation rota.", "oncall ops"],
      ["SLO Bootstrap", "slo-bootstrap", "Seeds default SLOs and an error budget policy.", "slo reliability"],
      ["Access Request", "access-request", "Files the standard access grant for a new team.", "access iam"],
    ],
  ],
  [
    "validate",
    "Knowledge Systems",
    [
      ["Evidence Lint", "evidence-lint", "Checks citations resolve to live anchors.", "evidence lint"],
      ["Guardrail Check", "guardrail-check", "Dry-runs guardrail policies against a plan.", "guardrails policy"],
      ["Dependency Audit", "dependency-audit", "Scans and pins third-party dependencies.", "security deps"],
      ["Config Drift Scan", "config-drift-scan", "Diffs live config against the recorded baseline.", "drift config"],
      ["Accessibility Lint", "accessibility-lint", "Flags a11y violations before release.", "a11y quality"],
      ["License Sweep", "license-sweep", "Verifies dependency licenses are allowed.", "license legal"],
      ["Secret Scan", "secret-scan", "Looks for leaked credentials in the repo.", "secrets security"],
      ["Perf Budget Check", "perf-budget-check", "Asserts bundle and latency budgets hold.", "perf quality"],
    ],
  ],
  [
    "rollout",
    "Platform Operations",
    [
      ["Region Promote", "region-promote", "Promotes a change across regions in waves.", "rollout regions"],
      ["Canary Deploy", "canary-deploy", "Ships a canary and watches its health gates.", "canary deploy"],
      ["Feature Flag Roll", "feature-flag-roll", "Steps a flag through its exposure ramp.", "flags rollout"],
      ["Blue-Green Switch", "blue-green-switch", "Shifts traffic between two live stacks.", "deploy traffic"],
      ["Rollback Drill", "rollback-drill", "Rehearses and times a clean rollback.", "rollback ops"],
      ["Migration Runner", "migration-runner", "Applies a schema migration with a backout.", "migration data"],
    ],
  ],
  [
    "context",
    "Knowledge Systems",
    [
      ["Context Bundle", "context-bundle", "Packages platform knowledge for an agent.", "context agents"],
      ["Runbook Export", "runbook-export", "Renders runbooks into an agent-readable form.", "runbook docs"],
      ["Glossary Sync", "glossary-sync", "Keeps the shared glossary current.", "glossary docs"],
      ["Decision Log Index", "decision-log-index", "Indexes ADRs for retrieval.", "adr context"],
      ["Skill Digest", "skill-digest", "Regenerates the agent skills index.", "agents index"],
    ],
  ],
];

const VERSION_CYCLE = ["1.0.0", "1.2.1", "2.0.0", "0.9.3", "1.4.0", "3.1.2"] as const;
const DATE_CYCLE = ["2026-06-04", "2026-05-19", "2026-04-30", "2026-03-22", "2026-02-11"] as const;

function buildSkill(stage: SkillStage, maintainer: string, seed: Seed, i: number): Skill {
  const [name, slug, blurb, tags] = seed;
  const version = VERSION_CYCLE[i % VERSION_CYCLE.length]!;
  const date = DATE_CYCLE[i % DATE_CYCLE.length]!;
  return {
    id: `scale-${slug}`,
    name,
    description: blurb,
    version,
    tags: tags.split(" "),
    stage,
    maintainer,
    updatedAt: date,
    whatItDoes: [
      `${blurb}`,
      "Runs the approved checks before making any change.",
      "Reports a summary and leaves an audit trail.",
    ],
    changelog: [
      { version, date, note: "Refreshed against the current platform baseline." },
      { version: "0.8.0", date: "2026-01-15", note: "Initial public release." },
    ],
  };
}

const GENERATED: ReadonlyArray<Skill> = SEEDS.flatMap(([stage, maintainer, seeds]) =>
  seeds.map((seed, i) => buildSkill(stage, maintainer, seed, i)),
);

/** Curated skills first (detail pages intact), then ~36 synthetic ones. */
export const SCALE_SKILLS: ReadonlyArray<Skill> = [...SKILLS, ...GENERATED];

const BY_ID = new Map(SCALE_SKILLS.map((s) => [s.id, s] as const));

/** Resolve a proto skill by id (curated + scale fixture). */
export function getProtoSkill(id: string): Skill | undefined {
  return BY_ID.get(id);
}
