import { describe, expect, it } from "vitest";
import { AvailabilityReadResponseSchema } from "@atlas/schema";
import { handleAvailabilityRequest } from "./availabilityRoute";
import { handleHttpRequest } from "./httpRoute";

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
});
