import { describe, expect, it } from "vitest";
import { AvailabilityReadResponseSchema } from "@atlas/schema";
import { handleAvailabilityRequest } from "./availabilityRoute";
import { handleHttpRequest } from "./httpRoute";
import { buildContextBundle } from "../services/contextBundleService";
import { createDefaultContextBundleService } from "../composition";

/**
 * The single availability read (plan 014): one cited Context Layer read backs
 * the Portal grid, the MCP tool, and the agent matrix row — all from ONE dataset.
 */
describe("availability read", () => {
  it("returns both landing zones with the governing availability-matrix Citation", () => {
    const result = handleAvailabilityRequest();
    expect(result.status).toBe(200);

    const body = AvailabilityReadResponseSchema.parse(result.body);
    expect(body.zones.map((zone) => zone.id)).toEqual(["aws", "azure"]);
    expect(body.citation.source_id).toBe("availability-matrix");
    expect(body.citation.location).toContain("Regional+Availability+Matrix");
    // The source is within its P90D review window at the real clock — no drift.
    expect(body.warnings).toEqual([]);
  });

  it("is reachable through the HTTP router as a cited JSON read", async () => {
    const response = await handleHttpRequest({ method: "GET", path: "/api/availability" });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");

    const body = AvailabilityReadResponseSchema.parse(JSON.parse(response.body));
    expect(body.zones).toHaveLength(2);
  });

  it("shares ONE dataset with the governed matrix resolver (no second source of facts)", async () => {
    // The grid read and the agent-facing matrix row must agree cell-for-cell,
    // because the markdown the resolver parses is projected from this same grid.
    const read = AvailabilityReadResponseSchema.parse(handleAvailabilityRequest().body);
    const s3 = read.zones
      .find((zone) => zone.id === "aws")!
      .services.find((service) => service.id === "s3")!;
    expect(s3.availability["us-east-1"]?.status).toBe("available");

    const bundle = await buildContextBundle(createDefaultContextBundleService(), {
      source_id: "availability-matrix",
      anchor_id: "availability-s3-us-east-1",
    });
    expect(bundle.sources[0]?.excerpts[0]?.text).toBe("S3 is available in us-east-1.");
  });
});
