import { describe, expect, it } from "vitest";
import type { Source, Warning } from "@atlas/schema";

import { classifyFreshness, highestPriorityWarning, parseDurationToMs } from "./evidence";

const sourceFixture: Source = {
  id: "test-source",
  title: "Test",
  source_class: "policy-document",
  location: "s3://test",
  visibility: "internal",
  authority_scope: ["test"],
  authority_level: "authoritative",
  last_observed_at: "2026-05-01T00:00:00.000Z",
  last_reviewed_at: "2026-04-01T00:00:00.000Z",
  review_frequency: "P90D",
};

describe("freshness classification", () => {
  const baseSource = {
    ...sourceFixture,
    review_frequency: "P90D",
    last_reviewed_at: "2026-01-01T00:00:00.000Z",
  };

  it("returns current when within the window", () => {
    expect(classifyFreshness(baseSource, new Date("2026-01-15T00:00:00.000Z"))).toBe("current");
  });

  it("returns needs-review when in the soft warning band", () => {
    // 80% of 90 days = 72 days
    expect(classifyFreshness(baseSource, new Date("2026-03-15T00:00:00.000Z"))).toBe(
      "needs-review",
    );
  });

  it("returns stale when the review window is past", () => {
    expect(classifyFreshness(baseSource, new Date("2026-05-01T00:00:00.000Z"))).toBe("stale");
  });

  it("falls back to needs-review for an unparseable duration", () => {
    expect(parseDurationToMs("garbage")).toBeUndefined();
    expect(
      classifyFreshness(
        { ...baseSource, review_frequency: "garbage" },
        new Date("2026-05-01T00:00:00.000Z"),
      ),
    ).toBe("needs-review");
  });
});

describe("highestPriorityWarning", () => {
  it("returns the most severe warning regardless of input order", () => {
    const warnings: Warning[] = [
      { code: "stale_source", message: "stale" },
      { code: "broken_anchor", message: "broken" },
      { code: "weak_anchoring", message: "weak" },
    ];
    expect(highestPriorityWarning(warnings)?.code).toBe("broken_anchor");
  });

  it("returns undefined when no warnings are provided", () => {
    expect(highestPriorityWarning([])).toBeUndefined();
  });
});
