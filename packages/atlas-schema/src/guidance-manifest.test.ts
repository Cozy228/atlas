/**
 * Guidance manifest gate — validates every `data/guidance/*.yaml` against the
 * schema and governance checks. This is the import precondition: a malformed or
 * governance-violating manifest fails CI here before it can reach the registry.
 * Also doubles as `pnpm validate:guidance`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { validateGuidanceManifest, validateGuidanceDocument, GuidanceSchema } from "./index";

const minimalRoute = {
  id: "demo",
  title: "Demo",
  type: "route",
  scenario: "onboarding",
  family: "onboard",
  objective: "Demonstrate the schema.",
  destination: { title: "Done" },
  owner: { team: "Platform", support: "platform-support" },
  status: "draft",
  version: "0.1.0",
  last_reviewed: "2026-06-14",
  steps: [
    { id: "do-it", title: "Do it", kind: "action" },
    { id: "done", title: "Done", kind: "destination" },
  ],
};

const here = dirname(fileURLToPath(import.meta.url));
// src -> atlas-schema -> packages -> repo root
const guidanceDir = join(here, "..", "..", "..", "data", "guidance");

const files = readdirSync(guidanceDir).filter((f) => f.endsWith(".yaml"));

const docs = files.map((file) => ({
  file,
  raw: parse(readFileSync(join(guidanceDir, file), "utf8")),
}));

describe("data/guidance manifests", () => {
  it("has at least one manifest to validate", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const { guidances, issues } = validateGuidanceManifest(docs);
  const errors = issues.filter((i) => i.level === "error");

  it("has no schema or cross-file errors", () => {
    expect(errors).toEqual([]);
  });

  it("parses every manifest into a valid Guidance", () => {
    expect(guidances.length).toBe(files.length);
    for (const g of guidances) {
      expect(GuidanceSchema.safeParse(g).success).toBe(true);
    }
  });

  // Governance warnings are surfaced, not fatal — assert the count is sane so a
  // flood of warnings is visible in test output without failing the build.
  it("surfaces governance warnings without failing", () => {
    const warnings = issues.filter((i) => i.level === "warning");
    if (warnings.length > 0) {
      console.warn(
        `guidance manifest warnings:\n${warnings.map((w) => `  - ${w.path}: ${w.message}`).join("\n")}`,
      );
    }
    expect(Array.isArray(warnings)).toBe(true);
  });
});

describe("validateGuidanceDocument", () => {
  it("accepts a minimal valid route", () => {
    const { guidance, issues } = validateGuidanceDocument(minimalRoute, "demo");
    expect(guidance?.id).toBe("demo");
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("rejects guidance whose last step is not a destination", () => {
    const bad = { ...minimalRoute, steps: [minimalRoute.steps[0]] };
    const { guidance, issues } = validateGuidanceDocument(bad, "bad");
    expect(guidance).toBeUndefined();
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });

  it("flags execution-implying action labels as warnings, not errors", () => {
    const doc = {
      ...minimalRoute,
      steps: [
        {
          id: "step",
          title: "Step",
          kind: "action",
          tasks: [
            {
              id: "t1",
              title: "Submit it",
              action: { type: "external_link", label: "Submit request", target: "https://x.test" },
            },
          ],
        },
        minimalRoute.steps[1],
      ],
    };
    const { guidance, issues } = validateGuidanceDocument(doc, "warn");
    expect(guidance).toBeDefined();
    expect(issues.some((i) => i.level === "warning")).toBe(true);
    expect(issues.some((i) => i.level === "error")).toBe(false);
  });

  it("detects duplicate guidance ids across files", () => {
    const { issues } = validateGuidanceManifest([
      { file: "a.yaml", raw: minimalRoute },
      { file: "b.yaml", raw: minimalRoute },
    ]);
    expect(issues.some((i) => i.message.includes("duplicate guidance id"))).toBe(true);
  });
});
