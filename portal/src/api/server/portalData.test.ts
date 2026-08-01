import { afterEach, describe, expect, it, vi } from "vitest";

import { loadPortalAvailability, resolveDataMode } from "./portalData";

const savedEnv = { ...process.env };
afterEach(() => {
  process.env = { ...savedEnv };
});

describe("Portal-only server data", () => {
  it("keeps the production data-mode gate authoritative", () => {
    process.env.NODE_ENV = "production";
    process.env.DEV_DATA_MODE = "mock";

    expect(resolveDataMode()).toBe("live");
  });

  it("preserves the five-minute process memo for availability", async () => {
    const getAvailability = vi.fn(async () => ({
      zones: [],
      citation: {
        source_id: "availability-matrix",
        label: "Regional Availability Matrix",
        location: "https://confluence.example.com/display/CLOUD/Regional+Availability+Matrix",
      },
      warnings: [],
    }));

    await expect(loadPortalAvailability({ getAvailability })).resolves.toEqual({ zones: [] });
    await expect(loadPortalAvailability({ getAvailability })).resolves.toEqual({ zones: [] });
    expect(getAvailability).toHaveBeenCalledTimes(1);
  });

  it("never shares memoized availability across authenticated requests", async () => {
    const firstClient = {
      getAvailability: vi.fn(async () => availabilityResult("first-zone")),
    };
    const secondClient = {
      getAvailability: vi.fn(async () => availabilityResult("second-zone")),
    };

    await expect(loadPortalAvailability(firstClient, { memoize: false })).resolves.toMatchObject({
      zones: [{ id: "first-zone" }],
    });
    await expect(loadPortalAvailability(secondClient, { memoize: false })).resolves.toMatchObject({
      zones: [{ id: "second-zone" }],
    });
    expect(firstClient.getAvailability).toHaveBeenCalledTimes(1);
    expect(secondClient.getAvailability).toHaveBeenCalledTimes(1);
  });
});

function availabilityResult(id: string) {
  return {
    zones: [
      {
        id,
        name: id,
        cloud: "aws" as const,
        dataStatus: "available" as const,
        locations: [],
        services: [],
      },
    ],
    citation: {
      source_id: "availability-matrix",
      label: "Regional Availability Matrix",
      location: "https://confluence.example.com/display/CLOUD/Regional+Availability+Matrix",
    },
    warnings: [],
  };
}
