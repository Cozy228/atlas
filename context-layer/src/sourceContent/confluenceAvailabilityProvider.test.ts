import { describe, expect, it } from "vitest";
import { DEV_AVAILABILITY_PAGE_ID_AWSF, DEV_CONFLUENCE_BASE_URL } from "../devMocks";
import { defaultResolutionContext } from "../resolvers/resolverTypes";
import { createConfluenceAvailabilityProvider } from "./confluenceAvailabilityProvider";

const env = {
  ATLAS_CONFLUENCE_BASE_URL: DEV_CONFLUENCE_BASE_URL,
  ATLAS_CONFLUENCE_TOKEN: "dev-mock-token",
  ATLAS_CONFLUENCE_AVAILABILITY_PAGE_AWSF: DEV_AVAILABILITY_PAGE_ID_AWSF,
};

function provider(envOverride: Record<string, string | undefined> = env) {
  return createConfluenceAvailabilityProvider({
    fetch: defaultResolutionContext().fetch,
    env: envOverride,
  });
}

describe("createConfluenceAvailabilityProvider — LZ-aware availability (plan 021 G3)", () => {
  it("discovers the wired awsf grid from its MSW page; awsc/azure are honest-empty", async () => {
    const zones = await provider().getZones();
    expect(zones.map((zone) => zone.id)).toEqual(["awsf", "awsc", "azure"]);

    const awsf = zones.find((zone) => zone.id === "awsf")!;
    expect(awsf.cloud).toBe("aws");
    expect(awsf.dataStatus).toBe("available");
    expect(awsf.locations.map((location) => location.id)).toContain("us-east-1");

    const textract = awsf.services.find((service) => service.id === "textract")!;
    expect(textract.name).toBe("Amazon Textract");
    expect(textract.domain).toBe("AI Services");
    expect(textract.availability["us-east-1"]?.status).toBe("available");

    // A planned cell round-trips its ETA note through the page render+parse.
    const ec2 = awsf.services.find((service) => service.id === "ec2")!;
    expect(ec2.availability.gdc).toEqual({ status: "planned", note: "05/30/2026" });

    for (const id of ["awsc", "azure"]) {
      const zone = zones.find((z) => z.id === id)!;
      expect(zone.dataStatus).toBe("not-available");
      expect(zone.services).toEqual([]);
      expect(zone.locations).toEqual([]);
    }
  });

  it("flattens the spine keyed by {cloud}/{id} — the cloud, never the LZ id, is the provider", async () => {
    const services = await provider().listServices();
    const keys = new Set(services.map((service) => service.key));

    expect(keys.has("aws/textract")).toBe(true);
    expect(keys.has("aws/s3")).toBe(true);
    expect(keys.has("aws/api-gateway")).toBe(true);
    // The LZ id never enters the address: provider is the cloud, not "awsf".
    expect(services.every((service) => service.provider === "aws")).toBe(true);
    expect(keys.size).toBe(services.length); // deduped by canonical key
  });

  it("returns honest-empty grids + spine when the Confluence channel is unconfigured", async () => {
    const zones = await provider({}).getZones();
    for (const zone of zones) {
      expect(zone.services).toEqual([]);
      expect(zone.locations).toEqual([]);
    }
    expect(await provider({}).listServices()).toEqual([]);
  });
});
