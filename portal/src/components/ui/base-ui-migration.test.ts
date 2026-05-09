import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const portalRoot = new URL("../../..", import.meta.url).pathname;
const uiRoot = join(portalRoot, "src/components/ui");

describe("Base UI shadcn wrapper migration", () => {
  it("keeps shadcn configured for Base UI", () => {
    const componentsJson = JSON.parse(
      readFileSync(join(portalRoot, "components.json"), "utf8"),
    ) as { style?: string };

    expect(componentsJson.style?.startsWith("base-")).toBe(true);
  });

  it("keeps Portal UI wrappers free of Radix primitives", () => {
    const radixImports = readdirSync(uiRoot)
      .filter((fileName) => fileName.endsWith(".tsx"))
      .flatMap((fileName) => {
        const contents = readFileSync(join(uiRoot, fileName), "utf8");

        return /from ["']radix-ui["']|@radix-ui\/react-/.test(contents) ? [fileName] : [];
      });

    expect(radixImports).toEqual([]);
  });
});
