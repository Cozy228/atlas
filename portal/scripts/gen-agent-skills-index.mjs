/**
 * Generator for the Agent Skills Discovery index (Cloudflare RFC v0.2.0).
 *
 * Scans `portal/public/.well-known/agent-skills/<name>/SKILL.md`, reads each
 * skill's YAML frontmatter (`name`, `description`), computes the RFC digest
 * (`sha256:<hex>` over the artifact's raw bytes), and writes `index.json`
 * next to them. Digests are never hand-maintained: every SKILL.md edit
 * changes its bytes, so this script must be re-run (it runs as part of
 * `pnpm build`); the committed digest-parity test catches any drift.
 *
 * Run from anywhere: node portal/scripts/gen-agent-skills-index.mjs
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SKILLS_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/.well-known/agent-skills",
);
const DISCOVERY_SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";

function frontmatterField(markdown, field) {
  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---/)?.[1];
  const value = frontmatter?.match(new RegExp(`^${field}:\\s*(.+)$`, "m"))?.[1].trim();
  if (!value) throw new Error(`SKILL.md frontmatter is missing "${field}".`);
  return value;
}

const skills = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => {
    const bytes = readFileSync(join(SKILLS_DIR, entry.name, "SKILL.md"));
    const markdown = bytes.toString("utf8");
    return {
      name: frontmatterField(markdown, "name"),
      type: "skill-md",
      description: frontmatterField(markdown, "description"),
      url: `/.well-known/agent-skills/${entry.name}/SKILL.md`,
      digest: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    };
  });

const index = { $schema: DISCOVERY_SCHEMA, skills };
writeFileSync(join(SKILLS_DIR, "index.json"), `${JSON.stringify(index, null, 2)}\n`);
console.log(`Wrote ${skills.length} skill(s) to ${join(SKILLS_DIR, "index.json")}`);
