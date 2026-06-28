import { describe, expect, it } from "vitest";
import { createDevAvailabilityProvider, listAvailabilityServices } from "./availability";

describe("listAvailabilityServices — discovery spine (plan 017 B2)", () => {
  const services = listAvailabilityServices();
  const keys = new Set(services.map((service) => service.key));

  it("enumerates the FULL grid across both provider zones, not the governed matrix", () => {
    // The spine is the whole availability grid (decision #2 / confirmed scope),
    // so it must be large and span both providers — never just the 3 matrix rows.
    expect(services.length).toBeGreaterThan(80);
    const providers = new Set(services.map((service) => service.provider));
    expect(providers).toEqual(new Set(["aws", "azure"]));
  });

  it("keys every service by canonical {provider}/{id}", () => {
    expect(keys.has("aws/textract")).toBe(true);
    expect(keys.has("aws/s3")).toBe(true);
    expect(keys.has("aws/api-gateway")).toBe(true);
    expect(keys.has("azure/aks")).toBe(true);
  });

  it("dedupes by canonical key — every key is unique", () => {
    expect(keys.size).toBe(services.length);
  });

  it("normalizes each entry's alias tiers", () => {
    const textract = services.find((service) => service.key === "aws/textract");
    expect(textract?.admissionAliases).toContain("textract");
    expect(textract?.recallAliases).toContain("textract");
  });

  it("is exposed through the AvailabilityProvider port", () => {
    const provider = createDevAvailabilityProvider();
    expect(provider.listServices().length).toBe(services.length);
  });
});
