import { afterEach, describe, expect, it } from "vitest";

import { markNavigationStart, markReady, NAVIGATION_START_MARK } from "./readinessMetrics";

afterEach(() => {
  performance.clearMarks();
  performance.clearMeasures();
});

describe("readiness metrics", () => {
  it("measures readiness from the browser navigation start", () => {
    markNavigationStart();
    markReady("atlas:test-ready");

    expect(performance.getEntriesByName(NAVIGATION_START_MARK)[0]?.startTime).toBe(0);
    expect(performance.getEntriesByName("atlas:test-ready-duration")[0]?.duration).toBeGreaterThan(
      0,
    );
  });

  it("records each readiness transition once", () => {
    markNavigationStart();
    markReady("atlas:test-ready");
    markReady("atlas:test-ready");

    expect(performance.getEntriesByName("atlas:test-ready")).toHaveLength(1);
    expect(performance.getEntriesByName("atlas:test-ready-duration")).toHaveLength(1);
  });
});
