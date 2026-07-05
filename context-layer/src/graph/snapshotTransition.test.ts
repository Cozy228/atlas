import { describe, expect, it } from "vitest";
import { runSnapshotTransition } from "./snapshotTransition";
import { InMemorySnapshotStore, pendingId } from "./snapshotStore";
import { InMemoryEventsRepository } from "../repositories/eventsRepository";
import { availabilityRootId } from "./rootIds";
import type { RootSnapshot } from "./graphTypes";

/**
 * D6 — the snapshot transition is CAS; the winner derives events inline (M10).
 * Concurrent passes over the same confirming delta yield ONE winner that appends
 * events; losers discard theirs, so the feed is never doubled or torn. Because
 * event ids are content hashes (M1), a re-run of the same transition is a no-op
 * even for the winner. Public-safe fictional data.
 */

const ROOT = availabilityRootId("zone-alpha");

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

/** Seed the store to a "first sighting held" state: confirmed=BASE, pending=DELTA,
 *  so the next successful DELTA parse CONFIRMS (and emits) — the transition under
 *  race. */
async function seedHeldDelta(store: InMemorySnapshotStore): Promise<void> {
  await store.compareAndSwap(ROOT, undefined, {
    confirmed: snap(BASE, "t0"),
    pending: snap(DELTA, "t1"),
  });
}

describe("runSnapshotTransition (D6)", () => {
  it("concurrent confirming transitions ⇒ one winner appends, losers append nothing", async () => {
    const store = new InMemorySnapshotStore();
    const events = new InMemoryEventsRepository();
    await seedHeldDelta(store);

    const deps = { store, events, now: () => new Date("2026-07-05T10:00:00.000Z") };
    const [a, b] = await Promise.all([
      runSnapshotTransition(ROOT, snap(DELTA, "t2"), deps),
      runSnapshotTransition(ROOT, snap(DELTA, "t2"), deps),
    ]);

    const winners = [a, b].filter((r) => r.won);
    expect(winners).toHaveLength(1);
    expect(winners[0].events.length).toBeGreaterThan(0);
    // The loser derived nothing durable.
    const loser = [a, b].find((r) => !r.won);
    expect(loser?.events).toEqual([]);

    // The feed holds exactly the winner's events — no duplicates, no torn writes.
    const feed = await events.listSince();
    expect(feed).toHaveLength(winners[0].events.length);
    expect(feed.map((e) => e.class)).toContain("service-added");
  });

  it("re-running the same transition is idempotent (content-hash id ⇒ no new rows)", async () => {
    const store = new InMemorySnapshotStore();
    const events = new InMemoryEventsRepository();
    await seedHeldDelta(store);
    const deps = { store, events, now: () => new Date("2026-07-05T10:00:00.000Z") };

    await runSnapshotTransition(ROOT, snap(DELTA, "t2"), deps);
    const afterFirst = (await events.listSince()).length;

    // Re-seed the same held delta (CAS against the CURRENT pending, so the
    // rewind actually lands) and replay: the transition CONFIRMS again, derives
    // the same events, and the same (class, subject, versions) hashes to the
    // same id ⇒ the conditional append is a no-op.
    const current = await store.read(ROOT);
    const rewound = await store.compareAndSwap(ROOT, pendingId(current.pending), {
      confirmed: snap(BASE, "t0"),
      pending: snap(DELTA, "t1"),
    });
    expect(rewound).toBe(true);
    const replay = await runSnapshotTransition(ROOT, snap(DELTA, "t2"), deps);
    expect(replay.won).toBe(true);
    // The winner re-derived the same events, but the store kept zero new rows.
    expect(replay.events).toHaveLength(0);
    expect((await events.listSince()).length).toBe(afterFirst);
  });

  it("a first sighting (not yet persisted) confirms nothing and appends nothing", async () => {
    const store = new InMemorySnapshotStore();
    const events = new InMemoryEventsRepository();
    // Baseline only; DELTA is seen for the FIRST time here.
    await store.compareAndSwap(ROOT, undefined, {
      confirmed: snap(BASE, "t0"),
      pending: snap(BASE, "t0"),
    });
    const deps = { store, events, now: () => new Date("2026-07-05T10:00:00.000Z") };

    const result = await runSnapshotTransition(ROOT, snap(DELTA, "t1"), deps);
    expect(result.events).toEqual([]);
    expect(await events.listSince()).toEqual([]);
  });
});
