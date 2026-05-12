import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const componentFiles = [
  "service-card.tsx",
  "matrix-view.tsx",
  "expand-panel.tsx",
] as const;

describe("explore service icons", () => {
  it("uses the shared AWS service icon in cards, matrix rows, and expanded panels", async () => {
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
    const source = await readFile(new URL("./service-icon.tsx", import.meta.url), "utf8");

    expect(source).not.toContain("border border-border");
  });

  it("supports larger icon sizes for capability identity surfaces", async () => {
    const source = await readFile(new URL("./service-icon.tsx", import.meta.url), "utf8");

    expect(source).toContain('xl: "size-12"');
    expect(source).toContain('hero: "size-16"');
    expect(source).toContain("xl: 38");
    expect(source).toContain("hero: 52");
  });
});
