import { describe, expect, it } from "vitest";

import { APP_CONTEXT, BLOCKER_EVIDENCE, JOURNEY_PHASES, RESOLVED_CONTEXT } from "./fixtures";

describe("codex prototype fixtures", () => {
  it("keeps one coherent application context", () => {
    expect(APP_CONTEXT.code).toBe("APP-4821");
    expect(RESOLVED_CONTEXT.find((entry) => entry.label === "Application")?.value).toBe(
      APP_CONTEXT.name,
    );
  });

  it("uses deterministic evidence with provenance", () => {
    expect(BLOCKER_EVIDENCE).toHaveLength(3);
    for (const item of BLOCKER_EVIDENCE) {
      expect(item.identifier).toMatch(/^(RUN|CHG)-/);
      expect(item.retrievedAt).toContain("Aug 14, 2026");
      expect(item.source.length).toBeGreaterThan(0);
    }
  });

  it("contains exactly one blocked journey step", () => {
    const blocked = JOURNEY_PHASES.flatMap((phase) => phase.steps).filter(
      (step) => step.status === "blocked",
    );
    expect(blocked.map((step) => step.id)).toEqual(["runtime"]);
  });
});
