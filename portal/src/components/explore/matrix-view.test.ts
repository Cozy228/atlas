import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MatrixView", () => {
  it("keeps the table header sticky against page scroll", async () => {
    const source = await readFile(new URL("./matrix-view.tsx", import.meta.url), "utf8");

    expect(source).toContain("sticky top-14");
    expect(source).toContain('data-slot="table"');
    expect(source).not.toContain("<Table ");
    expect(source).not.toContain("overflow-clip");
    expect(source).toContain("@tanstack/react-table");
    expect(source).toContain("motion/react");
    expect(source).toContain("useReactTable");
    expect(source).toContain("AnimatePresence");
  });
});
