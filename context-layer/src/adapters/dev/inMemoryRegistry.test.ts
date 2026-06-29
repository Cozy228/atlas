import { describe, expect, it } from "vitest";
import { InMemoryFeedbackRepository } from "../../repositories/feedbackRepository";
import { createInMemoryRegistry } from "./inMemoryRegistry";
import { loadRegistryFromManifests } from "./loadRegistryFromManifests";

describe("in-memory registry adapter", () => {
  it("loads validated repositories for the governed topics and sources", async () => {
    const registry = createInMemoryRegistry(loadRegistryFromManifests());

    expect(registry.topics.list()).toHaveLength(9);
    expect(registry.sources.list()).toHaveLength(13);
    expect(registry.anchors.list().length).toBeGreaterThan(10);
    expect((await registry.feedback.list()).length).toBeGreaterThan(0);
    expect(registry.mappings.list().length).toBeGreaterThan(12);
  });

  it("supports service and security-policy scenarios (landing zones are the availability scope, plan 019)", () => {
    const registry = createInMemoryRegistry(loadRegistryFromManifests());

    expect(registry.topics.findByType("service").length).toBeGreaterThan(0);
    expect(registry.topics.findByType("security-policy").length).toBeGreaterThan(0);
    // Landing zones moved to the availability grid — no catalog topics remain.
    expect(registry.topics.findByType("landing-zone")).toEqual([]);
  });

  it("includes stale, deprecated, restricted, and broken-anchor examples", () => {
    const registry = createInMemoryRegistry(loadRegistryFromManifests());
    const sources = registry.sources.list();

    expect(sources.some((source) => source.id === "legacy-s3-policy")).toBe(true);
    expect(sources.some((source) => source.authority_level === "deprecated")).toBe(true);
    expect(sources.some((source) => source.visibility === "restricted")).toBe(true);
    expect(
      registry.anchors.list().some((anchor) => String(anchor.selector.locator).includes("missing")),
    ).toBe(true);
  });

  it("rejects malformed seed records before repositories are created", () => {
    const seed = loadRegistryFromManifests();
    expect(() =>
      createInMemoryRegistry({
        ...seed,
        topics: [{ ...(seed.topics[0] as Record<string, unknown>), owner_team: null }],
      }),
    ).toThrow();
  });

  it("can use an injected feedback repository for runtime persistence", () => {
    const feedback = new InMemoryFeedbackRepository();
    const registry = createInMemoryRegistry(loadRegistryFromManifests(), { feedback });

    expect(registry.feedback).toBe(feedback);
    expect(registry.feedback.list()).toEqual([]);
  });
});
