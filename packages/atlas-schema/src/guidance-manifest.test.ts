/**
 * Guidance manifest gate (schema-package unit tier) — exercises the
 * `validateGuidanceDocument` / `validateGuidanceManifest` logic directly. The
 * gate over the actual guidance source-of-truth (the MSW-served manifests, plan
 * 018 G6) lives in `@atlas/context-layer` (`devMocks/guidanceFixture.test.ts`,
 * run by `pnpm validate:guidance`), where the fixture is importable — this
 * package cannot depend on context-layer.
 */
import { describe, expect, it } from "vitest";
import { validateGuidanceManifest, validateGuidanceDocument } from "./index";

const minimalRoute = {
  id: "demo",
  title: "Demo",
  scenario: "onboarding",
  family: "onboard",
  objective: "Demonstrate the schema.",
  destination: { title: "Done" },
  owner: { team: "Platform", support: "platform-support" },
  status: "draft",
  version: "0.1.0",
  last_reviewed: "2026-06-14",
  steps: [
    { id: "do-it", title: "Do it" },
    { id: "wrap-up", title: "Wrap up" },
  ],
};

describe("validateGuidanceDocument", () => {
  it("accepts a minimal valid journey", () => {
    const { guidance, issues } = validateGuidanceDocument(minimalRoute, "demo");
    expect(guidance?.id).toBe("demo");
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("rejects guidance with no steps", () => {
    const bad = { ...minimalRoute, steps: [] };
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
