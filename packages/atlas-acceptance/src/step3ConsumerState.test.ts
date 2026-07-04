import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppManifestSchema, AvailabilityReadResponseSchema } from "@atlas/schema";
import { handleHttpRequest, sharedAppsRepository } from "@atlas/context-layer";
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

/**
 * D5 — by-value, zero-registration scoped answer (Step 3, M11 + P26; locked
 * decisions 5, 7). An agent reads a repo manifest (`atlas.app.yaml`) and passes
 * its `landingZones` BY VALUE on the wire (`?landingZones=`); availability
 * returns exactly the member zones — and the apps store receives ZERO writes,
 * because a by-value read never registers (no upsert-on-read).
 *
 * This is the public-safe proof boundary (ADR-0004): the raw HTTP router stands
 * in for a deployed endpoint, driven exactly as an external agent would. The
 * manifest is the parsed `atlas.app.yaml` object (fictional), validated through
 * the frozen `AppManifestSchema` so D1's manifest contract is exercised here too.
 */

// Single live path (plan 018 G5): point every discovery channel at the MSW
// fixtures so `awsf` is a wired availability zone.
const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  setDevDiscoveryEnv();
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

/** The `atlas.app.yaml` an agent would read from its working directory
 *  (fictional). Parsed through the frozen `AppManifestSchema` inside each test
 *  so the file still collects in Batch 0, where the schema stub throws. */
const RAW_MANIFEST = {
  name: "Orion Checkout",
  landingZones: ["awsf"],
  services: ["aws/textract"],
};

async function availabilityZones(query: Record<string, string>): Promise<string[]> {
  const response = await handleHttpRequest({
    method: "GET",
    path: "/api/availability",
    query,
  });
  const parsed = AvailabilityReadResponseSchema.parse(JSON.parse(response.body));
  return parsed.zones.map((zone) => zone.id);
}

describe("D5: by-value manifest scope → scoped availability, zero store writes", () => {
  it("passes the manifest's landingZones on the wire → exactly the member zones", async () => {
    const manifest = AppManifestSchema.parse(RAW_MANIFEST);
    const scoped = await availabilityZones({ landingZones: manifest.landingZones.join(",") });
    expect(scoped).toEqual(["awsf"]);

    // Control: the unscoped read still returns the full topology (more than the
    // single member), so the scoping is real, not a fixture that only has one LZ.
    const unscoped = await availabilityZones({});
    expect(unscoped.length).toBeGreaterThan(1);
    expect(unscoped).toContain("azure");
  });

  it("registers NOTHING: the by-value read never writes to the apps store (M11)", async () => {
    const manifest = AppManifestSchema.parse(RAW_MANIFEST);
    const repo = sharedAppsRepository(process.env);
    const putSpy = vi.spyOn(repo, "put");

    await availabilityZones({ landingZones: manifest.landingZones.join(",") });

    expect(putSpy).not.toHaveBeenCalled();
    putSpy.mockRestore();
  });
});
