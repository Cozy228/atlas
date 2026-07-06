import { beforeEach, describe, expect, it } from "vitest";
import {
  estimateTokens,
  incrementCounter,
  observeHistogram,
  resetMetrics,
  snapshot,
} from "./metrics";

/**
 * D1 — the hand-rolled metrics registry: labelled counters + fixed-bucket
 * histograms, a since-boot snapshot, and exception-safe observation (a throwing
 * observer NEVER propagates — a metrics failure must never fail a brief, locked
 * decision 10).
 */
describe("metrics registry (D1)", () => {
  beforeEach(() => resetMetrics());

  it("counts by label dimensions", () => {
    incrementCounter("brief_blocks", { status: "available" });
    incrementCounter("brief_blocks", { status: "available" });
    incrementCounter("brief_blocks", { status: "unresolved" });

    const counters = snapshot().counters;
    const available = counters.find(
      (c) => c.name === "brief_blocks" && c.labels.status === "available",
    );
    const unresolved = counters.find(
      (c) => c.name === "brief_blocks" && c.labels.status === "unresolved",
    );
    expect(available?.value).toBe(2);
    expect(unresolved?.value).toBe(1);
  });

  it("observes cumulative histogram buckets with count + sum + a JSON-safe +Inf", () => {
    observeHistogram("h", { moment: "adopt" }, 7, [5, 10]);
    observeHistogram("h", { moment: "adopt" }, 3, [5, 10]);

    const h = snapshot().histograms.find((x) => x.name === "h");
    expect(h?.count).toBe(2);
    expect(h?.sum).toBe(10);
    // Cumulative: le=5 counts only the 3; le=10 counts both; +Inf is the total.
    expect(h?.buckets).toEqual([
      { le: "5", count: 1 },
      { le: "10", count: 2 },
      { le: "+Inf", count: 2 },
    ]);
  });

  it("labels different series independently", () => {
    observeHistogram("brief_time_to_brief_ms", { channel: "mcp" }, 1, [10]);
    observeHistogram("brief_time_to_brief_ms", { channel: "http" }, 2, [10]);
    const series = snapshot().histograms.filter((h) => h.name === "brief_time_to_brief_ms");
    expect(series.map((s) => s.labels.channel).sort()).toEqual(["http", "mcp"]);
  });

  it("carries a since-boot ISO timestamp", () => {
    expect(() => new Date(snapshot().since).toISOString()).not.toThrow();
    expect(snapshot().since).toBe(new Date(snapshot().since).toISOString());
  });

  it("estimates tokens as chars/4 (no tokenizer)", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
  });

  it("a throwing observer never propagates and leaves the registry usable", () => {
    // A hostile labels object whose key enumeration throws inside the registry.
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("boom");
        },
      },
    ) as Record<string, string>;

    expect(() => incrementCounter("c", hostile)).not.toThrow();
    expect(() => observeHistogram("h", hostile, 1, [1])).not.toThrow();

    // The registry keeps working after a swallowed failure.
    incrementCounter("ok", { a: "1" });
    expect(snapshot().counters.some((c) => c.name === "ok")).toBe(true);
  });
});
