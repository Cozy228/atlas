/**
 * D2 — the default-context ladder is gone (Step 1, I2). A source-level grep
 * gate: after Batch 2 no code path can fall back to an ungoverned default
 * context, and the governed brand never leaks through the package root.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function read(relativeToThisFile: string): string {
  return readFileSync(fileURLToPath(new URL(relativeToThisFile, import.meta.url)), "utf8");
}

describe("D2 — the default-context ladder is deleted (grep gate)", () => {
  it("D2: the package-root barrel does not export defaultResolutionContext", () => {
    expect(read("../index.ts")).not.toContain("defaultResolutionContext");
  });

  it("D2: no default-context fallback remains in resolverTypes / resourceContextService / resourceRoutes", () => {
    // The ladder's rungs: the function itself, the default parameter, the
    // optional ctx. Delete, don't deprecate — every call site constructs
    // through the factory instead.
    expect(read("./resolverTypes.ts")).not.toContain("defaultResolutionContext");
    expect(read("../resources/resourceContextService.ts")).not.toContain(
      "defaultResolutionContext",
    );
    expect(read("../api/resourceRoutes.ts")).not.toContain("defaultResolutionContext");
    expect(read("../api/resourceRoutes.ts")).not.toMatch(/ctx\?\s*:/);
  });

  it("D2: the governed brand symbol exists module-private and is never exported from the root barrel", () => {
    const factorySource = read("./createResolutionContext.ts");
    // The brand must exist as a unique symbol and must not be exported from
    // its module...
    expect(factorySource).toMatch(/unique symbol/);
    expect(factorySource).not.toMatch(/export[^\n]*unique symbol/);
    // ...and the root barrel re-exports nothing brand-shaped.
    expect(read("../index.ts")).not.toMatch(/[Bb]rand/);
  });

  it("D2: cachedResolutionContext's role is absorbed by the factory — no longer exported from the root barrel", () => {
    expect(read("../index.ts")).not.toContain("cachedResolutionContext");
  });

  it("decision 5: scope_drift and scope_unresolved join the existing schema warning union — no parallel vocabulary", () => {
    const schemaSource = read("../../../packages/atlas-schema/src/index.ts");
    expect(schemaSource).toContain('"scope_drift"');
    expect(schemaSource).toContain('"scope_unresolved"');
  });
});
