import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ResourceCatalogResponseSchema, SourceDiscoveryResponseSchema } from "@atlas/schema";
import { setDevDiscoveryEnv } from "../devMocks";
import { handleResourceCatalogRequest } from "./resourceRoutes";
import { handleSourceDiscoveryRequest } from "./sourceDiscoveryRoute";

// Post-collapse the registry + catalog are the OUTPUT of live discovery, so point
// every channel at the MSW fixtures (the global devMocks/setup.ts keeps the
// Node-mode server listening); with no env the catalog is honest-empty.
const savedEnv = { ...process.env };
beforeAll(() => setDevDiscoveryEnv());
afterAll(() => {
  process.env = savedEnv;
});

describe("discovery routes", () => {
  it("discovers sources by class through the shared response schema", async () => {
    const response = await handleSourceDiscoveryRequest({
      source_class: "terraform-module",
    });

    expect(response.status).toBe(200);
    const sources = SourceDiscoveryResponseSchema.parse(response.body).sources;
    // Every discovered service is module-backed in the coherent fixture, so the
    // class filter returns one terraform-module source per service (N is data).
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((source) => source.source_class === "terraform-module")).toBe(true);
  });

  it("lists discovered resources through the catalog response schema", async () => {
    const response = await handleResourceCatalogRequest();

    expect(response.status).toBe(200);
    const resources = ResourceCatalogResponseSchema.parse(response.body).resources;
    // The SECPOL space fixture carries four cross-cutting guardrails; services are
    // module-backed alongside them in the same catalog feed.
    const guardrails = resources.filter((resource) => resource.kind === "guardrail");
    expect(guardrails.length).toBe(4);
    expect(resources.some((resource) => resource.kind === "service")).toBe(true);
  });
});
