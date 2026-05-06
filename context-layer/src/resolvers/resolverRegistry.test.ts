import { describe, expect, it } from "vitest";
import { createResolverRegistry } from "./resolverRegistry.js";
import { confluencePageResolver } from "./confluencePageResolver.js";
import { policyDocumentResolver } from "./policyDocumentResolver.js";
import { terraformModuleResolver } from "./terraformModuleResolver.js";

describe("resolver registry", () => {
  it("registers V1 resolvers by source class", () => {
    const registry = createResolverRegistry([
      terraformModuleResolver,
      confluencePageResolver,
      policyDocumentResolver,
    ]);

    expect(registry.get("terraform-module")).toBe(terraformModuleResolver);
    expect(registry.get("confluence-page")).toBe(confluencePageResolver);
    expect(registry.get("policy-document")).toBe(policyDocumentResolver);
  });

  it("rejects duplicate source class registrations", () => {
    expect(() =>
      createResolverRegistry([terraformModuleResolver, terraformModuleResolver]),
    ).toThrow();
  });
});
