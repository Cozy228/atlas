import { describe, expect, it } from "vitest";
import { DATA_DIR, loadRegistryFromManifests } from "./loadRegistryFromManifests.js";
import { pilotRegistrySeed } from "./pilotRegistry.js";

describe("loadRegistryFromManifests", () => {
  // The equivalence oracle: the authored data/*.yaml must reproduce the seed
  // byte-for-byte (id-for-id, field-for-field), so Portal/Skill behavior is
  // unchanged when the runtime switches from the seed to the manifests.
  it("deep-equals the pilot registry seed", () => {
    expect(loadRegistryFromManifests(DATA_DIR)).toEqual(pilotRegistrySeed);
  });

  it("returns the expected collection sizes", () => {
    const seed = loadRegistryFromManifests(DATA_DIR);
    expect(seed.sources).toHaveLength(14);
    expect(seed.topics).toHaveLength(11);
    expect(seed.anchors).toHaveLength(16);
    expect(seed.mappings).toHaveLength(18);
    expect(seed.feedback.length).toBeGreaterThan(0);
  });

  it("throws an actionable error when the manifest directory is missing", () => {
    expect(() => loadRegistryFromManifests("/no/such/data/dir")).toThrow();
  });
});
