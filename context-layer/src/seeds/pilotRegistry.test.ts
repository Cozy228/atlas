import { describe, expect, it } from "vitest";
import { loadPilotRegistry, pilotRegistrySeed } from "./pilotRegistry.js";

describe("pilot registry seed", () => {
  it("loads validated repositories for V1 pilot topics and governed sources", () => {
    const registry = loadPilotRegistry(pilotRegistrySeed);

    expect(registry.topics.list()).toHaveLength(10);
    expect(registry.sources.list()).toHaveLength(12);
    expect(registry.anchors.list().length).toBeGreaterThan(10);
    expect(registry.feedback.list().length).toBeGreaterThan(0);
    expect(registry.mappings.list().length).toBeGreaterThan(12);
  });

  it("supports capability, landing-zone, and guardrail-area scenarios", () => {
    const registry = loadPilotRegistry(pilotRegistrySeed);

    expect(registry.topics.findByType("capability").length).toBeGreaterThan(0);
    expect(registry.topics.findByType("landing-zone").length).toBeGreaterThan(0);
    expect(registry.topics.findByType("guardrail-area").length).toBeGreaterThan(0);
  });

  it("includes stale, deprecated, restricted, and broken-anchor examples", () => {
    const registry = loadPilotRegistry(pilotRegistrySeed);
    const sources = registry.sources.list();

    expect(sources.some((source) => source.id === "legacy-s3-policy")).toBe(true);
    expect(sources.some((source) => source.authority_level === "deprecated")).toBe(
      true,
    );
    expect(sources.some((source) => source.visibility === "restricted")).toBe(true);
    expect(
      registry.anchors
        .list()
        .some((anchor) => String(anchor.selector.locator).includes("missing")),
    ).toBe(true);
  });

  it("rejects malformed seed records before repositories are created", () => {
    expect(() =>
      loadPilotRegistry({
        ...pilotRegistrySeed,
        topics: [
          {
            ...pilotRegistrySeed.topics[0],
            owner_team: null,
          },
        ],
      }),
    ).toThrow();
  });
});
