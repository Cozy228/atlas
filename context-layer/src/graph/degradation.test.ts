import { describe, expect, it, vi } from "vitest";
import { computeFreshness, SNAPSHOT_STALE_AFTER_MS } from "./freshness";
import { serveRootSnapshot } from "./snapshotTransition";
import { InMemorySnapshotStore } from "./snapshotStore";
import { InMemoryEventsRepository } from "../repositories/eventsRepository";
import { availabilityRootId } from "./rootIds";
import type { RootSnapshot } from "./graphTypes";

/**
 * D10 — honest aging (acceptance B, ADR-0013 §6). A failed root serves its
 * last-good snapshot with `resolvedAt` unchanged and staleness RECOMPUTED at
 * read (never a second clock); killing one root ages exactly that subgraph while
 * the others stay live. Public-safe fictional data.
 */

function snap(rootId: string, services: string[], resolvedAt: string): RootSnapshot {
  return {
    rootId,
    resolvedAt,
    contractVersion: "availability-v1",
    parse: {
      kind: "availability",
      landingZoneId: rootId.replace("availability:", ""),
      landingZoneName: rootId,
      services: services.map((slug) => ({ slug, name: slug, domain: "AI" })),
    },
  };
}

describe("computeFreshness (D10: one clock)", () => {
  it("is recomputed from resolvedAt vs now, not stored", () => {
    const resolvedAt = "2026-07-05T10:00:00.000Z";
    const fresh = computeFreshness(resolvedAt, new Date("2026-07-05T10:10:00.000Z"));
    expect(fresh.stale).toBe(false);
    expect(fresh.ageMs).toBe(10 * 60 * 1000);

    const aged = computeFreshness(
      resolvedAt,
      new Date(Date.parse(resolvedAt) + SNAPSHOT_STALE_AFTER_MS + 1),
    );
    expect(aged.stale).toBe(true);
    // The served clock is still the ORIGINAL parse time (never bumped to now).
    expect(aged.resolvedAt).toBe(resolvedAt);
  });
});

describe("serveRootSnapshot degradation (D10)", () => {
  const ALPHA = availabilityRootId("zone-alpha");
  const BETA = availabilityRootId("zone-beta");

  it("a failed refresh serves last-good + an aging note, resolvedAt unchanged", async () => {
    const store = new InMemorySnapshotStore();
    const t0 = "2026-07-01T00:00:00.000Z";
    await store.compareAndSwap(ALPHA, undefined, {
      confirmed: snap(ALPHA, ["a"], t0),
      pending: snap(ALPHA, ["a"], t0),
    });

    // The refresh crawl throws (the source root is down), but a last-good exists.
    const now = new Date("2026-07-09T00:00:00.000Z"); // well past the stale horizon
    const failingCrawl = vi
      .fn<() => Promise<RootSnapshot>>()
      .mockRejectedValue(new Error("root down"));
    const result = await serveRootSnapshot(ALPHA, failingCrawl, {
      store,
      events: new InMemoryEventsRepository(),
      now: () => now,
    });

    // Served the last-good parse, with its ORIGINAL resolvedAt (decision 8).
    expect(result.snapshot.resolvedAt).toBe(t0);
    expect(result.aging?.rootId).toBe(ALPHA);
    expect(result.aging?.resolvedAt).toBe(t0);
    // Zero phantom events on a degradation gap.
    expect(result.transition?.events ?? []).toEqual([]);
  });

  it("killing one root ages ONLY its subgraph; other roots stay live", async () => {
    const store = new InMemorySnapshotStore();
    const t0 = "2026-07-01T00:00:00.000Z";
    for (const root of [ALPHA, BETA]) {
      await store.compareAndSwap(root, undefined, {
        confirmed: snap(root, ["a"], t0),
        pending: snap(root, ["a"], t0),
      });
    }
    const now = new Date("2026-07-09T00:00:00.000Z");
    const deps = { store, events: new InMemoryEventsRepository(), now: () => now };

    // ALPHA's crawl fails; BETA's succeeds with a fresh parse.
    const alpha = await serveRootSnapshot(
      ALPHA,
      vi.fn<() => Promise<RootSnapshot>>().mockRejectedValue(new Error("down")),
      deps,
    );
    const betaFresh = snap(BETA, ["a"], now.toISOString());
    const beta = await serveRootSnapshot(
      BETA,
      vi.fn<() => Promise<RootSnapshot>>().mockResolvedValue(betaFresh),
      deps,
    );

    expect(alpha.aging).toBeTruthy();
    expect(beta.aging).toBeUndefined();
    expect(beta.snapshot.resolvedAt).toBe(now.toISOString());
  });
});
