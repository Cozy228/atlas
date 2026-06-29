import { describe, expect, it } from "vitest";
import { createInMemoryRegistry } from "./inMemoryRegistry";
import { DATA_DIR, loadRegistryFromManifests } from "./loadRegistryFromManifests";

describe("loadRegistryFromManifests", () => {
  // Schema + self-consistency guard (replaces the old deep-equals-against-a-
  // code-copy oracle): a successful assembly proves every authored record passes
  // its `@atlas/schema` parse AND that every mapping/feedback target resolves to a
  // real source/topic — those integrity checks live in createInMemoryRegistry.
  it("loads a schema-valid, referentially-consistent registry", () => {
    expect(() => createInMemoryRegistry(loadRegistryFromManifests(DATA_DIR))).not.toThrow();
  });

  it("returns the expected collection sizes", () => {
    const seed = loadRegistryFromManifests(DATA_DIR);
    expect(seed.sources).toHaveLength(13);
    expect(seed.topics).toHaveLength(9);
    expect(seed.mappings).toHaveLength(14);
    expect(seed.feedback.length).toBeGreaterThan(0);
  });

  it("returns an empty registry (honest gap) when the manifest directory is missing", () => {
    const seed = loadRegistryFromManifests("/no/such/data/dir");
    expect(seed).toEqual({ sources: [], topics: [], mappings: [], feedback: [] });
    expect(() => createInMemoryRegistry(seed)).not.toThrow();
  });
});
