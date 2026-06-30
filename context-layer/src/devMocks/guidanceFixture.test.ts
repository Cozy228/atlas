/**
 * Guidance authoring gate — validates BOTH guidance sources end to end:
 *   - the store manifests (`DEV_GUIDANCE_MANIFESTS`) against `@atlas/schema`, and
 *   - each authored Confluence page (`DEV_GUIDANCE_PAGES`), which must parse via
 *     the live `parseGuidancePage` into a manifest that also clears the schema.
 * A manifest that drifts, or a page that drifts from the authoring convention,
 * fails CI here before it can reach the loader. Doubles as `pnpm validate:guidance`.
 */
import { describe, expect, it } from "vitest";
import { GuidanceSchema, validateGuidanceManifest } from "@atlas/schema";
import { parseGuidancePage } from "../sourceContent/confluenceGuidanceProvider";
import { DEV_GUIDANCE_MANIFESTS, DEV_GUIDANCE_PAGES } from "./guidanceFixture";

const pages = Object.values(DEV_GUIDANCE_PAGES);
const pageParses = pages.map((page) => ({
  page,
  parsed: parseGuidancePage(page.title, page.body.storage.value),
}));

const expectedCount = DEV_GUIDANCE_MANIFESTS.length + pages.length;

describe("guidance sources", () => {
  it("has at least one journey to validate", () => {
    // The store is intentionally empty in the dev demo (onboarding-only); the
    // authored Confluence page(s) carry the shipped journey. Both sources stay
    // wired, so a store manifest added later is still validated below.
    expect(DEV_GUIDANCE_MANIFESTS.length + pages.length).toBeGreaterThan(0);
    expect(pages.length).toBeGreaterThan(0);
  });

  it("parses every authored Confluence page (no convention drift)", () => {
    for (const { page, parsed } of pageParses) {
      expect(parsed.ok, `${page.title}: ${parsed.ok ? "" : parsed.reason}`).toBe(true);
    }
  });

  const docs = [
    ...DEV_GUIDANCE_MANIFESTS.map((raw) => ({ file: `${raw.id as string}.store`, raw })),
    ...pageParses
      .filter((entry) => entry.parsed.ok)
      .map((entry) => ({
        file: entry.page.title,
        raw: entry.parsed.ok ? entry.parsed.manifest : {},
      })),
  ];
  const { guidances, issues } = validateGuidanceManifest(docs);
  const errors = issues.filter((i) => i.level === "error");

  it("has no schema or cross-file errors", () => {
    expect(errors).toEqual([]);
  });

  it("validates every journey into a valid Guidance", () => {
    expect(guidances.length).toBe(expectedCount);
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
        `guidance warnings:\n${warnings.map((w) => `  - ${w.path}: ${w.message}`).join("\n")}`,
      );
    }
    expect(Array.isArray(warnings)).toBe(true);
  });
});
