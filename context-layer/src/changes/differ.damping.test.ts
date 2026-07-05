import { describe, expect, it } from "vitest";
import { decideDamping } from "./damping";
import { noteRootDegradation } from "../graph/snapshotTransition";
import { InMemorySnapshotStore } from "../graph/snapshotStore";
import type { RootSnapshot, SnapshotPair } from "../graph/graphTypes";

/**
 * D5 — stability damping (M6). A delta emits an event only after it survives two
 * consecutive successful parses:
 *   - a single-parse flap (B → X → B) emits ZERO events;
 *   - a degradation gap (root fails → last-good) emits ZERO events + one aging
 *     note (never a storm of phantom removals);
 *   - a delta that persists (B → X → X) emits exactly ONE event.
 * Damping uses only the K=2 pair (confirmed + pending). Public-safe fictional data.
 */

const ROOT = "availability:zone-alpha";

/** A snapshot whose parse content is `services` (the delta-bearing facts). */
function snap(services: string[], resolvedAt: string): RootSnapshot {
  return {
    rootId: ROOT,
    resolvedAt,
    contractVersion: "availability-v1",
    parse: {
      kind: "availability",
      landingZoneId: "zone-alpha",
      landingZoneName: "Alpha",
      services: services.map((slug) => ({ slug, name: slug, domain: "AI" })),
    },
  };
}

const BASE = ["cloudx/parser"];
const DELTA = ["cloudx/parser", "cloudx/vault"];

describe("decideDamping (D5)", () => {
  it("cold root: the first parse seeds the baseline silently", () => {
    const outcome = decideDamping({}, snap(BASE, "t0"));
    expect(outcome.kind).toBe("seed");
    expect(outcome.next.confirmed?.parse).toEqual(outcome.next.pending?.parse);
  });

  it("a single-parse flap (B → X → B) never confirms", () => {
    // Baseline established.
    let pair: SnapshotPair = decideDamping({}, snap(BASE, "t0")).next;
    // First sighting of the delta X: HELD, not confirmed.
    const first = decideDamping(pair, snap(DELTA, "t1"));
    expect(first.kind).toBe("hold");
    pair = first.next;
    // Next parse reverts to baseline: the flap resolves, still no event.
    const revert = decideDamping(pair, snap(BASE, "t2"));
    expect(revert.kind).toBe("noop");
    expect(revert.next.confirmed?.parse).toEqual(snap(BASE, "t2").parse);
  });

  it("a delta that persists across two parses confirms exactly once", () => {
    let pair: SnapshotPair = decideDamping({}, snap(BASE, "t0")).next;
    // First sighting: held.
    pair = decideDamping(pair, snap(DELTA, "t1")).next;
    // Second consecutive sighting: confirmed → the from/to the differ diffs.
    const confirm = decideDamping(pair, snap(DELTA, "t2"));
    expect(confirm.kind).toBe("confirm");
    if (confirm.kind === "confirm") {
      expect(confirm.from.parse).toEqual(snap(BASE, "t0").parse);
      expect(confirm.to.parse).toEqual(snap(DELTA, "t2").parse);
    }
    // Once confirmed, the same facts are a noop (baseline advanced).
    expect(decideDamping(confirm.next, snap(DELTA, "t3")).kind).toBe("noop");
  });

  it("a re-fetch that changes nothing (only resolvedAt moves) is a noop", () => {
    const pair = decideDamping({}, snap(BASE, "t0")).next;
    expect(decideDamping(pair, snap(BASE, "t1")).kind).toBe("noop");
  });
});

describe("noteRootDegradation (D5 gap)", () => {
  it("a failed root serves last-good: zero events, one aging note, resolvedAt unchanged", async () => {
    const store = new InMemorySnapshotStore();
    // Seed a confirmed snapshot, then degrade (a failed refresh).
    await store.compareAndSwap(ROOT, undefined, {
      confirmed: snap(BASE, "t0"),
      pending: snap(BASE, "t0"),
    });

    const note = await noteRootDegradation(ROOT, {
      store,
      now: () => new Date("2026-07-09T00:00:00.000Z"),
    });
    expect(note).not.toBeNull();
    // The served clock is the last-good parse clock, NOT now (decision 8).
    expect(note?.resolvedAt).toBe("t0");
    expect(note?.rootId).toBe(ROOT);
  });

  it("a cold root with no last-good produces no aging note", async () => {
    const store = new InMemorySnapshotStore();
    const note = await noteRootDegradation(ROOT, {
      store,
      now: () => new Date("2026-07-09T00:00:00.000Z"),
    });
    expect(note).toBeNull();
  });
});
