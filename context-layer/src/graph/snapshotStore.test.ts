import { describe, expect, it, vi } from "vitest";
import { InMemorySnapshotStore, pendingId } from "./snapshotStore";
import { serveRootSnapshot } from "./snapshotTransition";
import { InMemoryEventsRepository } from "../repositories/eventsRepository";
import type { RootSnapshot } from "./graphTypes";

/**
 * D1 — the per-root snapshot store persists a `SnapshotPair` (K=2: confirmed +
 * pending) with a real `resolvedAt`, reads back per root, and swaps atomically
 * (CAS). A warm read serves from the snapshot with ZERO crawls (cold-start /
 * multi-task crawl collapse). Public-safe fictional data.
 */

const ROOT = "availability:zone-alpha";

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

describe("InMemorySnapshotStore (D1)", () => {
  it("a cold root reads back an empty pair", async () => {
    const store = new InMemorySnapshotStore();
    expect(await store.read(ROOT)).toEqual({});
  });

  it("persists a pair and reads it back per root with its real resolvedAt", async () => {
    const store = new InMemorySnapshotStore();
    const won = await store.compareAndSwap(ROOT, undefined, {
      confirmed: snap(["a"], "t0"),
      pending: snap(["a"], "t0"),
    });
    expect(won).toBe(true);

    const pair = await store.read(ROOT);
    expect(pair.pending?.resolvedAt).toBe("t0");
    expect(pair.confirmed?.resolvedAt).toBe("t0");
    // Other roots stay independent (per-root keying).
    expect(await store.read("terraform")).toEqual({});
  });

  it("retains exactly K=2 (confirmed baseline + pending observation)", async () => {
    const store = new InMemorySnapshotStore();
    await store.compareAndSwap(ROOT, undefined, {
      confirmed: snap(["a"], "t0"),
      pending: snap(["a", "b"], "t1"),
    });
    const pair = await store.read(ROOT);
    expect(pair.confirmed?.resolvedAt).toBe("t0");
    expect(pair.pending?.resolvedAt).toBe("t1");
    // No third slot exists on the pair shape — history beyond K=2 is `events`.
    expect(Object.keys(pair).sort()).toEqual(["confirmed", "pending"]);
  });

  it("CAS: a stale expected-pending id loses and leaves state unchanged", async () => {
    const store = new InMemorySnapshotStore();
    await store.compareAndSwap(ROOT, undefined, {
      confirmed: snap(["a"], "t0"),
      pending: snap(["a"], "t0"),
    });
    const current = await store.read(ROOT);

    // A writer that expected a DIFFERENT pending id loses.
    const lost = await store.compareAndSwap(ROOT, "stale-id", {
      confirmed: snap(["x"], "t9"),
      pending: snap(["x"], "t9"),
    });
    expect(lost).toBe(false);
    expect(await store.read(ROOT)).toEqual(current);

    // A writer with the correct expected id wins.
    const won = await store.compareAndSwap(ROOT, pendingId(current.pending), {
      confirmed: snap(["a", "b"], "t1"),
      pending: snap(["a", "b"], "t1"),
    });
    expect(won).toBe(true);
    expect((await store.read(ROOT)).pending?.resolvedAt).toBe("t1");
  });

  it("readAll returns every retained root's pair", async () => {
    const store = new InMemorySnapshotStore();
    await store.compareAndSwap(ROOT, undefined, { pending: snap(["a"], "t0") });
    const terraform = snap(["a"], "t0");
    await store.compareAndSwap("terraform", undefined, {
      pending: { ...terraform, rootId: "terraform" },
    });
    expect([...(await store.readAll()).keys()].sort()).toEqual([ROOT, "terraform"].sort());
  });
});

describe("serveRootSnapshot warm read (D1: 0 crawls)", () => {
  it("serves a fresh pending snapshot WITHOUT crawling the source", async () => {
    const store = new InMemorySnapshotStore();
    const now = new Date("2026-07-05T10:00:00.000Z");
    await store.compareAndSwap(ROOT, undefined, {
      confirmed: snap(["a"], now.toISOString()),
      pending: snap(["a"], now.toISOString()),
    });

    const crawl = vi.fn<() => Promise<RootSnapshot>>();
    const result = await serveRootSnapshot(ROOT, crawl, {
      store,
      events: new InMemoryEventsRepository(),
      now: () => now,
    });

    expect(crawl).not.toHaveBeenCalled();
    expect(result.crawled).toBe(false);
    expect(result.snapshot.parse).toEqual(snap(["a"], now.toISOString()).parse);
  });

  it("a cold root crawls exactly once and stores the result", async () => {
    const store = new InMemorySnapshotStore();
    const now = new Date("2026-07-05T10:00:00.000Z");
    const fresh = snap(["a"], now.toISOString());
    const crawl = vi.fn<() => Promise<RootSnapshot>>().mockResolvedValue(fresh);

    const result = await serveRootSnapshot(ROOT, crawl, {
      store,
      events: new InMemoryEventsRepository(),
      now: () => now,
    });

    expect(crawl).toHaveBeenCalledTimes(1);
    expect(result.crawled).toBe(true);
    expect((await store.read(ROOT)).pending?.parse).toEqual(fresh.parse);
  });
});
