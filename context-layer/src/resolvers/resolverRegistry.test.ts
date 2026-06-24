import { describe, expect, it } from "vitest";
import { createResolverRegistry } from "./resolverRegistry";
import { confluencePageResolver } from "./confluencePageResolver";
import { policyDocumentResolver } from "./policyDocumentResolver";
import { terraformModuleResolver } from "./terraformModuleResolver";

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
