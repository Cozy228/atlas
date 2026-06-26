import { describe, expect, it } from "vitest";

import { getNextSearchIndex } from "./ask-atlas-search";

describe("Ask Atlas search keyboard navigation", () => {
  it("keeps selection stable when no results are available", () => {
    expect(getNextSearchIndex(0, 0, "next")).toBe(0);
    expect(getNextSearchIndex(2, 0, "previous")).toBe(0);
  });

  it("wraps selection through available results", () => {
    expect(getNextSearchIndex(2, 3, "next")).toBe(0);
    expect(getNextSearchIndex(0, 3, "previous")).toBe(2);
  });
});
