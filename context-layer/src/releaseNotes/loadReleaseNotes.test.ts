import { describe, expect, it } from "vitest";
import { loadReleaseNotes } from "./loadReleaseNotes";

describe("loadReleaseNotes", () => {
  it("loads the authored manifest newest-first with parsed items", () => {
    const releases = loadReleaseNotes();
    expect(releases.length).toBeGreaterThanOrEqual(2);

    // Newest first by posted date.
    const dates = releases.map((r) => r.postedAt);
    expect([...dates].sort((a, b) => (b ?? "").localeCompare(a ?? ""))).toEqual(dates);

    const may23 = releases.find((r) => r.id === "rel-2026-05-23");
    expect(may23?.month).toBe("May 2026");
    expect(may23?.changeRequest).toBe("CHG0010002");
    expect(may23?.items.some((i) => i.ticket === "PLAT-120")).toBe(true);
  });

  it("supports several releases in one month (bi-monthly)", () => {
    const may = loadReleaseNotes().filter((r) => r.month === "May 2026");
    expect(may.length).toBeGreaterThanOrEqual(2);
  });
});
