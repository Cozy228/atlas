import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const componentFiles = ["matrix-view.tsx"] as const;

describe("explore service icons", () => {
  it("uses the shared service icon in matrix rows", async () => {
    const sources = await Promise.all(
      componentFiles.map(async (file) => ({
        file,
        source: await readFile(new URL(`./${file}`, import.meta.url), "utf8"),
      })),
    );

    for (const { file, source } of sources) {
      expect(source, file).toContain("ServiceIcon");
      expect(source, file).not.toContain("{service.iconKey}");
    }
  });

  it("keeps service icon wrappers borderless", async () => {
    const source = await readFile(new URL("./service-icon-frame.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("border border-border");
  });

  it("keeps both icon packs out of the eager chunk via dynamic import", async () => {
    const serviceIconSource = await readFile(
      new URL("./service-icon.tsx", import.meta.url),
      "utf8",
    );

    // Both providers preload + lazy-load symmetrically.
    expect(serviceIconSource).toContain("preloadAzureServiceIcons");
    expect(serviceIconSource).toContain("preloadAwsServiceIcons");
    // The icon maps are loaded on demand, never statically imported at the top
    // (a static import would pull the whole pack into the eager entry chunk).
    expect(serviceIconSource).toContain('import("@/lib/azure-icon-map")');
    expect(serviceIconSource).toContain('import("@/lib/aws-icon-map")');
    expect(serviceIconSource).not.toMatch(/from\s+["']@\/lib\/(aws|azure)-icon-map["']/);
  });

  it("supports larger icon sizes for service identity surfaces", async () => {
    const source = await readFile(new URL("./service-icon-frame.tsx", import.meta.url), "utf8");

    expect(source).toContain('xl: "size-12"');
    expect(source).toContain('hero: "size-16"');
    expect(source).toContain("xl: 38");
    expect(source).toContain("hero: 52");
  });
});
