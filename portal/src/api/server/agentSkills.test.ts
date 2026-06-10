import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ContextBundleResponseSchema, TopicDiscoveryResponseSchema } from "@atlas/schema";

import { bridgeContextApiRequest } from "./contextApiBridge.js";
import { serverContextApiClient } from "./serverContextApiClient.js";

/**
 * Agent Skills Discovery (Cloudflare RFC v0.2.0) publication tests.
 *
 * The single publication source of truth is `portal/public/.well-known/...`;
 * `index.json` is generated from file bytes by `scripts/gen-agent-skills-index.mjs`.
 * These tests catch digest drift (the gotcha that broke the reverted attempt)
 * and RFC shape violations before they ship.
 */

const SKILLS_DIR = fileURLToPath(
  new URL("../../../public/.well-known/agent-skills/", import.meta.url),
);

type SkillEntry = {
  name: string;
  type: string;
  description: string;
  url: string;
  digest: string;
};

const index = JSON.parse(readFileSync(`${SKILLS_DIR}index.json`, "utf8")) as {
  $schema: string;
  skills: SkillEntry[];
};

function artifactBytes(entry: SkillEntry): Buffer {
  return readFileSync(`${SKILLS_DIR}${entry.url.replace("/.well-known/agent-skills/", "")}`);
}

describe("agent-skills digest parity", () => {
  it("every digest equals sha256 recomputed from the artifact's raw bytes", () => {
    expect(index.skills.length).toBeGreaterThan(0);
    for (const entry of index.skills) {
      const recomputed = `sha256:${createHash("sha256").update(artifactBytes(entry)).digest("hex")}`;
      expect(entry.digest).toBe(recomputed);
    }
  });

  it("every published SKILL.md on disk is listed in index.json", () => {
    const onDisk = readdirSync(SKILLS_DIR, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name)
      .sort();
    const listed = index.skills
      .map((entry) => entry.url.match(/^\/\.well-known\/agent-skills\/([^/]+)\/SKILL\.md$/)?.[1])
      .sort();
    expect(listed).toEqual(onDisk);
  });
});

describe("agent-skills RFC v0.2.0 shape", () => {
  it("declares the v0.2.0 discovery schema", () => {
    expect(index.$schema).toBe("https://schemas.agentskills.io/discovery/0.2.0/schema.json");
  });

  it("every entry satisfies the required fields and formats", () => {
    for (const entry of index.skills) {
      expect(entry.name).toMatch(/^[a-z0-9-]{1,64}$/);
      expect(entry.name).not.toMatch(/claude|anthropic/);
      expect(["skill-md", "archive"]).toContain(entry.type);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeLessThanOrEqual(1024);
      expect(entry.url.length).toBeGreaterThan(0);
      expect(entry.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("each SKILL.md has matching frontmatter and stays under the authoring limits", () => {
    for (const entry of index.skills) {
      const markdown = artifactBytes(entry).toString("utf8");
      const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---/)?.[1];
      expect(frontmatter).toBeDefined();
      expect(frontmatter).toContain(`name: ${entry.name}`);
      expect(frontmatter).toContain(`description: ${entry.description}`);
      expect(markdown.split("\n").length).toBeLessThan(500);
    }
  });
});

describe("atlas-context-consumer bundle parity", () => {
  /**
   * The behavior the skill instructs — resolve a topic, then consume the
   * bundle — must hit the same Context API contract the Portal uses. The
   * bridge below is the exact function served at `/api/*` on the Portal
   * origin; `serverContextApiClient` is what Portal loaders consume.
   */
  it("the skill's instructed flow returns the same bundle the Portal client gets", async () => {
    // Step 1 of the SKILL.md: GET /api/topics?query=textract
    const discovery = await bridgeContextApiRequest(
      new Request("https://portal.example.com/api/topics?query=textract"),
    );
    expect(discovery.status).toBe(200);
    const topics = TopicDiscoveryResponseSchema.parse(await discovery.json());
    const topic = topics.topics.find((candidate) => candidate.id === "aws-textract");
    expect(topic).toBeDefined();

    // Step 2 of the SKILL.md: GET /api/topics/{topic_id}/context
    const response = await bridgeContextApiRequest(
      new Request("https://portal.example.com/api/topics/aws-textract/context"),
    );
    expect(response.status).toBe(200);
    const skillBundle = ContextBundleResponseSchema.parse(await response.json());

    const portalBundle = await serverContextApiClient.getContextBundle({
      topic_id: "aws-textract",
    });

    // One governed bundle contract for both consumers (ignoring the per-request id).
    expect({ ...skillBundle, bundle_id: "x" }).toEqual({ ...portalBundle, bundle_id: "x" });

    // Atlas's evidence principle: every Excerpt carries its Citation.
    for (const source of skillBundle.sources) {
      for (const excerpt of source.excerpts) {
        expect(excerpt.citation.source_id).toBe(source.source.id);
      }
    }
  });
});
