import { describe, expect, it } from "vitest";
import { buildContextBundle } from "./contextBundleService";
import { createDefaultContextBundleService } from "../composition";

/**
 * Availability as Evidence (ADR-0009): the region × Service matrix resolves
 * through the real Context API bundle from a registered Source with a Citation,
 * and freshness/drift surfaces as a warning — not from the Portal-native fixture.
 */
describe("availability matrix through the Context API bundle", () => {
  it("resolves a cell from the registered source with a citation", async () => {
    const service = createDefaultContextBundleService();

    const bundle = await buildContextBundle(service, {
      source_id: "availability-matrix",
      anchor_id: "availability-s3-us-east-1",
    });

    const excerpt = bundle.sources[0]?.excerpts[0];
    expect(excerpt?.text).toBe("S3 is available in us-east-1.");
    expect(excerpt?.citation).toMatchObject({
      source_id: "availability-matrix",
      anchor_id: "availability-s3-us-east-1",
      label: "Availability Matrix → S3 × us-east-1",
    });
  });

  it("surfaces drift as a stale_source warning once the source is past review", async () => {
    const service = createDefaultContextBundleService();
    // P90D from a 2026-05-01 review lapses well before this clock.
    const drifted = { ...service, now: new Date("2026-09-01T00:00:00.000Z") };

    const bundle = await buildContextBundle(drifted, {
      source_id: "availability-matrix",
      anchor_id: "availability-s3-us-east-1",
    });

    expect(bundle.warnings.some((warning) => warning.code === "stale_source")).toBe(true);
    // Drift is surfaced alongside the cell, not instead of it.
    expect(bundle.sources[0]?.excerpts[0]?.text).toBe("S3 is available in us-east-1.");
  });
});
