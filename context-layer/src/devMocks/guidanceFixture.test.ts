/**
 * Guidance manifest gate (plan 018 G6) — validates the MSW-served guidance
 * manifests (the runtime source-of-truth, replacing `data/guidance/*.yaml`)
 * against `@atlas/schema` and the governance checks. A malformed or
 * governance-violating manifest fails CI here before it can reach the loader.
 * Also doubles as `pnpm validate:guidance`.
 */
import { describe, expect, it } from "vitest";
import { GuidanceSchema, validateGuidanceManifest } from "@atlas/schema";
import { DEV_GUIDANCE_MANIFESTS } from "./guidanceFixture";

const docs = DEV_GUIDANCE_MANIFESTS.map((raw) => ({ file: `${raw.id as string}.guidance`, raw }));

describe("guidance manifests", () => {
  it("has at least one manifest to validate", () => {
    expect(DEV_GUIDANCE_MANIFESTS.length).toBeGreaterThan(0);
  });

  const { guidances, issues } = validateGuidanceManifest(docs);
  const errors = issues.filter((i) => i.level === "error");

  it("has no schema or cross-file errors", () => {
    expect(errors).toEqual([]);
  });

  it("parses every manifest into a valid Guidance", () => {
    expect(guidances.length).toBe(DEV_GUIDANCE_MANIFESTS.length);
    for (const g of guidances) {
      expect(GuidanceSchema.safeParse(g).success).toBe(true);
    }
  });

  // Governance warnings are surfaced, not fatal — assert the shape so a flood of
  // warnings is visible in test output without failing the build.
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
