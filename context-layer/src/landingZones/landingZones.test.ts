import { describe, expect, it } from "vitest";
import { LandingZoneSchema } from "@atlas/schema";
import { LANDING_ZONES, resolveLandingZoneSource } from "./index";

describe("LANDING_ZONES topology", () => {
  it("is the three sample landing zones, each valid against LandingZoneSchema", () => {
    expect(LANDING_ZONES.map((zone) => zone.id)).toEqual(["awsf", "awsc", "azure"]);
    for (const zone of LANDING_ZONES) {
      expect(() => LandingZoneSchema.parse(zone)).not.toThrow();
    }
  });

  it("wires awsf and marks awsc/azure data-not-available (ADR-0006 honesty)", () => {
    const byId = Object.fromEntries(LANDING_ZONES.map((zone) => [zone.id, zone]));
    expect(byId.awsf).toMatchObject({ cloud: "aws", dataStatus: "available" });
    expect(byId.awsc).toMatchObject({ cloud: "aws", dataStatus: "not-available" });
    expect(byId.azure).toMatchObject({ cloud: "azure", dataStatus: "not-available" });
  });
});

describe("resolveLandingZoneSource", () => {
  const awsf = LANDING_ZONES[0];

  it("returns undefined when the Confluence channel is unconfigured (honest absence)", () => {
    expect(resolveLandingZoneSource(awsf, {})).toBeUndefined();
  });

  it("returns the per-LZ locator when env supplies connection + page id", () => {
    const source = resolveLandingZoneSource(awsf, {
      ATLAS_CONFLUENCE_BASE_URL: "https://example.test/wiki",
      ATLAS_CONFLUENCE_TOKEN: "sample-token",
      ATLAS_CONFLUENCE_AVAILABILITY_PAGE_AWSF: "1234",
    });
    expect(source).toEqual({
      baseUrl: "https://example.test/wiki",
      token: "sample-token",
      email: undefined,
      pageId: "1234",
    });
  });

  it("does not fabricate a locator from another LZ's page var", () => {
    expect(
      resolveLandingZoneSource(awsf, {
        ATLAS_CONFLUENCE_BASE_URL: "https://example.test/wiki",
        ATLAS_CONFLUENCE_TOKEN: "sample-token",
        ATLAS_CONFLUENCE_AVAILABILITY_PAGE_AZURE: "9999",
      }),
    ).toBeUndefined();
  });
});
