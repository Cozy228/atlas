import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const componentFiles = ["service-card.tsx", "matrix-view.tsx", "expand-panel.tsx"] as const;

describe("explore service icons", () => {
  it("uses the shared service icon in cards, matrix rows, and expanded panels", async () => {
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

  it("loads Azure service icons through a lazy provider module", async () => {
    const serviceIconSource = await readFile(
      new URL("./service-icon.tsx", import.meta.url),
      "utf8",
    );
    const azureIconSource = await readFile(
      new URL("./azure-service-icon.tsx", import.meta.url),
      "utf8",
    );

    expect(serviceIconSource).toContain("preloadAzureServiceIcons");
    expect(serviceIconSource).not.toContain("AZURE_ICON_MAP");
    expect(azureIconSource).toContain("AZURE_ICON_MAP");
  });

  it("supports larger icon sizes for service identity surfaces", async () => {
    const source = await readFile(new URL("./service-icon-frame.tsx", import.meta.url), "utf8");

    expect(source).toContain('xl: "size-12"');
    expect(source).toContain('hero: "size-16"');
    expect(source).toContain("xl: 38");
    expect(source).toContain("hero: 52");
  });
});
