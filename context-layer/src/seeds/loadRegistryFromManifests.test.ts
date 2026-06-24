import { describe, expect, it } from "vitest";
import { DATA_DIR, loadRegistryFromManifests } from "./loadRegistryFromManifests";
import { pilotRegistrySeed } from "./pilotRegistry";

describe("loadRegistryFromManifests", () => {
  // The equivalence oracle: the authored data/*.yaml must reproduce the seed
  // byte-for-byte (id-for-id, field-for-field), so Portal/Skill behavior is
  // unchanged when the runtime switches from the seed to the manifests.
  it("deep-equals the pilot registry seed", () => {
    expect(loadRegistryFromManifests(DATA_DIR)).toEqual(pilotRegistrySeed);
  });

  it("returns the expected collection sizes", () => {
    const seed = loadRegistryFromManifests(DATA_DIR);
    expect(seed.sources).toHaveLength(16);
    expect(seed.topics).toHaveLength(12);
    expect(seed.anchors).toHaveLength(23);
    expect(seed.mappings).toHaveLength(20);
    expect(seed.feedback.length).toBeGreaterThan(0);
  });

  it("throws an actionable error when the manifest directory is missing", () => {
    expect(() => loadRegistryFromManifests("/no/such/data/dir")).toThrow();
  });
});
