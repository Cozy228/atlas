import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AvailabilityReadResponseSchema } from "@atlas/schema";
import { DEV_AVAILABILITY_PAGE_ID_AWSF, DEV_CONFLUENCE_BASE_URL } from "../devMocks";
import { handleAvailabilityRequest } from "./availabilityRoute";
import { handleHttpRequest } from "./httpRoute";

/**
 * The LZ-aware availability read (plan 014, plan 021 G3): one cited Context Layer
 * read backs the Portal grid, the MCP tool, and the agent matrix row. The wired
 * `awsf` landing zone is discovered from its MSW availability page; the unwired
 * `awsc`/`azure` zones return honest-empty grids (ADR-0006), never another LZ's data.
 */
const saved = {
  baseUrl: process.env.ATLAS_CONFLUENCE_BASE_URL,
  token: process.env.ATLAS_CONFLUENCE_TOKEN,
  page: process.env.ATLAS_CONFLUENCE_AVAILABILITY_PAGE_AWSF,
};
beforeAll(() => {
  process.env.ATLAS_CONFLUENCE_BASE_URL = DEV_CONFLUENCE_BASE_URL;
  process.env.ATLAS_CONFLUENCE_TOKEN = "dev-mock-token";
  process.env.ATLAS_CONFLUENCE_AVAILABILITY_PAGE_AWSF = DEV_AVAILABILITY_PAGE_ID_AWSF;
});
afterAll(() => {
  restore("ATLAS_CONFLUENCE_BASE_URL", saved.baseUrl);
  restore("ATLAS_CONFLUENCE_TOKEN", saved.token);
  restore("ATLAS_CONFLUENCE_AVAILABILITY_PAGE_AWSF", saved.page);
});
function restore(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

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
