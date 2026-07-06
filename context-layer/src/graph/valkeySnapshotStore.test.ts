import { describe, expect, it, vi } from "vitest";
import { ValkeySnapshotStore, type SnapshotClient } from "./valkeySnapshotStore";
import type { RootSnapshot, SnapshotPair } from "./graphTypes";

/**
 * T1a — `ValkeySnapshotStore` over a FAKE client (no live Valkey in CI): a
 * `SnapshotPair` round-trips as JSON, the scripted CAS yields exactly one winner
 * under contention AND atomically records the root in the index (one SET+SADD
 * script), `readAll` uses the roots index (no SCAN), no TTL is ever set, and a
 * runtime op error degrades to the SAFE value (never a memory fallback).
 * Public-safe fictional data.
 */

// Braces = the Valkey hash tag the factory wraps the env-hash in, so the pair
// keys and the roots index share one cluster slot (see snapshotStoreFactory.ts).
const PREFIX = "discovery:{testhash}";

function snap(rootId: string, resolvedAt: string): RootSnapshot {
  return {
    rootId,
    resolvedAt,
    contractVersion: "availability-v1",
    parse: {
      kind: "availability",
      landingZoneId: rootId.replace("availability:", ""),
      landingZoneName: rootId,
      services: [{ slug: "cloudx/svc", name: "Svc", domain: "AI" }],
    },
  };
}

/**
 * A Map-backed stand-in for the Valkey client. `casSwap` DELIBERATELY mirrors the
 * server-side {@link SNAPSHOT_CAS_LUA} rather than delegating to the TS
 * `pendingId()` helper: it JSON-decodes the stored pair, reads
 * `pending.contractVersion` + `pending.resolvedAt` joined by '@' (absent/broken ⇒
 * ""), swaps on an exact match, and — atomically, in the same call — records the
 * root in the index (the Lua's SET+SADD). Written inline so a drift in the Lua
 * formula would fail this test rather than being hidden by a shared helper.
 */
function fakeClient() {
  const kv = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const calls = { setWithTtl: 0 };
  const client: SnapshotClient = {
    async get(key) {
      return kv.get(key) ?? null;
    },
    async casSwap(key, indexKey, expectedPendingId, nextValue, rootId) {
      const cur = kv.get(key);
      let curPending = "";
      if (cur !== undefined) {
        try {
          const decoded = JSON.parse(cur) as SnapshotPair;
          const pending = decoded.pending;
          if (pending && typeof pending === "object") {
            curPending = `${pending.contractVersion}@${pending.resolvedAt}`;
          }
        } catch {
          curPending = "";
        }
      }
      if (curPending !== expectedPendingId) {
        return false;
      }
      kv.set(key, nextValue);
      const set = sets.get(indexKey) ?? new Set<string>();
      set.add(rootId);
      sets.set(indexKey, set);
      return true;
    },
    async listRoots(indexKey) {
      return Array.from(sets.get(indexKey) ?? []);
    },
  };
  return { client, kv, sets, calls };
}

const ALPHA = "availability:zone-alpha";
const BETA = "availability:zone-beta";

describe("ValkeySnapshotStore (T1a)", () => {
  it("round-trips a SnapshotPair as JSON under the per-root key", async () => {
    const fake = fakeClient();
    const store = new ValkeySnapshotStore(fake.client, PREFIX);
    const pair: SnapshotPair = { confirmed: snap(ALPHA, "t0"), pending: snap(ALPHA, "t0") };

    expect(await store.compareAndSwap(ALPHA, undefined, pair)).toBe(true);
    expect(await store.read(ALPHA)).toEqual(pair);
    // One key per root under the env-scoped prefix.
    expect([...fake.kv.keys()]).toEqual([`${PREFIX}:${ALPHA}`]);
    // The value is the JSON pair — no wrapping envelope, no TTL field.
    expect(JSON.parse(fake.kv.get(`${PREFIX}:${ALPHA}`)!)).toEqual(pair);
  });

  it("a cold root reads back an empty pair", async () => {
    const store = new ValkeySnapshotStore(fakeClient().client, PREFIX);
    expect(await store.read(ALPHA)).toEqual({});
  });

  it("CAS yields exactly one winner under contention (same expected pending id)", async () => {
    const fake = fakeClient();
    const store = new ValkeySnapshotStore(fake.client, PREFIX);
    // Seed a confirmed+pending baseline at t0.
    await store.compareAndSwap(ALPHA, undefined, {
      confirmed: snap(ALPHA, "t0"),
      pending: snap(ALPHA, "t0"),
    });
    // The caller's expected pending id, computed the same way a production caller
    // does (`${contractVersion}@${resolvedAt}`) — inline, not via `pendingId()`.
    const seed = snap(ALPHA, "t0");
    const expected = `${seed.contractVersion}@${seed.resolvedAt}`;

    // Two writers race off the SAME expected pending id — only one may win.
    const first = await store.compareAndSwap(ALPHA, expected, {
      confirmed: snap(ALPHA, "t0"),
      pending: snap(ALPHA, "t1"),
    });
    const second = await store.compareAndSwap(ALPHA, expected, {
      confirmed: snap(ALPHA, "t0"),
      pending: snap(ALPHA, "t2"),
    });

    expect(first).toBe(true);
    expect(second).toBe(false);
    // The winner's value stands; the loser's is discarded.
    expect((await store.read(ALPHA)).pending?.resolvedAt).toBe("t1");
  });

  it("readAll uses the roots index (no SCAN) and returns every written root", async () => {
    const fake = fakeClient();
    const store = new ValkeySnapshotStore(fake.client, PREFIX);
    await store.compareAndSwap(ALPHA, undefined, { pending: snap(ALPHA, "t0") });
    await store.compareAndSwap(BETA, undefined, { pending: snap(BETA, "t0") });

    // The index set is populated ATOMICALLY on each successful write (SET+SADD).
    expect(fake.sets.get(`${PREFIX}:roots`)).toEqual(new Set([ALPHA, BETA]));

    const all = await store.readAll();
    expect([...all.keys()].sort()).toEqual([ALPHA, BETA]);
    expect(all.get(ALPHA)?.pending?.resolvedAt).toBe("t0");
  });

  it("a runtime read error degrades to the safe value (cold), never throws", async () => {
    const client: SnapshotClient = {
      get: vi.fn().mockRejectedValue(new Error("valkey down")),
      casSwap: vi.fn(),
      listRoots: vi.fn(),
    };
    const store = new ValkeySnapshotStore(client, PREFIX);
    expect(await store.read(ALPHA)).toEqual({});
  });

  it("a runtime CAS error returns lost (false), never a memory fallback", async () => {
    const client: SnapshotClient = {
      get: vi.fn().mockResolvedValue(null),
      casSwap: vi.fn().mockRejectedValue(new Error("valkey down")),
      listRoots: vi.fn(),
    };
    const store = new ValkeySnapshotStore(client, PREFIX);
    expect(await store.compareAndSwap(ALPHA, undefined, { pending: snap(ALPHA, "t0") })).toBe(
      false,
    );
  });
});
