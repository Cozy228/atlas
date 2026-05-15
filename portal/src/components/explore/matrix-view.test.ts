import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("MatrixView table wiring", () => {
  it("renders the availability matrix through TanStack Table", async () => {
    const source = await readFile(new URL("./matrix-view.tsx", import.meta.url), "utf8");

    expect(source).toContain('from "@tanstack/react-table"');
    expect(source).toContain("useReactTable");
    expect(source).toContain("getCoreRowModel");
    expect(source).toContain("flexRender");
    expect(source).toContain("table.getHeaderGroups()");
    expect(source).toContain("row.getVisibleCells()");
  });
});
