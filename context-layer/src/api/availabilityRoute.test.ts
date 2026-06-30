import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AvailabilityReadResponseSchema } from "@atlas/schema";
import { setDevDiscoveryEnv } from "../devMocks";
import { handleAvailabilityRequest } from "./availabilityRoute";
import { handleHttpRequest } from "./httpRoute";

/**
 * The LZ-aware availability read (plan 014, plan 021 G3): one cited Context Layer
 * read backs the Portal grid, the MCP tool, and the agent matrix row. The wired
 * `awsf` landing zone is discovered from its MSW availability page; the unwired
 * `awsc`/`azure` zones return honest-empty grids (ADR-0006), never another LZ's data.
 *
 * Post-flip (plan 018 G5) the availability-matrix Source is itself a discovery
 * output, so the whole discovery env must be pointed at the fixtures (probing the
 * service modules over the spine runs as part of building the service).
 */
const savedEnv = { ...process.env };
beforeAll(() => setDevDiscoveryEnv());
afterAll(() => {
  process.env = savedEnv;
});

describe("availability read", () => {
  it("returns the landing zones with the governing availability-matrix Citation", async () => {
    const result = await handleAvailabilityRequest();
    expect(result.status).toBe(200);

    const body = AvailabilityReadResponseSchema.parse(result.body);
    // The LZ root drives the zones; `awsf` is wired, `awsc`/`azure` honest-empty.
    expect(body.zones.map((zone) => zone.id)).toEqual(["awsf", "awsc", "azure"]);

    const awsf = body.zones.find((zone) => zone.id === "awsf")!;
    expect(awsf.cloud).toBe("aws");
    expect(awsf.dataStatus).toBe("available");
    expect(awsf.services.length).toBeGreaterThan(0);
    expect(awsf.locations.length).toBeGreaterThan(0);

    for (const id of ["awsc", "azure"]) {
      const zone = body.zones.find((z) => z.id === id)!;
      expect(zone.dataStatus).toBe("not-available");
      expect(zone.services).toEqual([]);
      expect(zone.locations).toEqual([]);
    }

    expect(body.citation.source_id).toBe("availability-matrix");
    // The source is within its P90D review window at the real clock — no drift.
    expect(body.warnings).toEqual([]);
  });

  it("is reachable through the HTTP router as a cited JSON read", async () => {
    const response = await handleHttpRequest({ method: "GET", path: "/api/availability" });
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");

    const body = AvailabilityReadResponseSchema.parse(JSON.parse(response.body));
    expect(body.zones).toHaveLength(3);
  });
});
