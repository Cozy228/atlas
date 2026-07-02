import { afterEach, describe, expect, it, vi } from "vitest";
import { logger } from "../observability/logging";
import type { FetchLike } from "../resolvers/resolverTypes";
import type { CachedResponse, SourceContentCache } from "./sourceContentCache";
import {
  InMemoryContentCache,
  ResilientContentCache,
  createSourceContentCache,
  withCache,
} from "./sourceContentCache";

function jsonResponse(body: unknown, status = 200): Awaited<ReturnType<FetchLike>> {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("InMemoryContentCache", () => {
  it("stores and returns within the TTL, then expires", async () => {
    let clock = 1_000;
    const cache = new InMemoryContentCache({ now: () => clock });

    await cache.set("k", { status: 200, body: { hi: true } }, 10);
    expect(await cache.get("k")).toEqual({ status: 200, body: { hi: true } });

    clock += 10_001; // past the 10s TTL
    expect(await cache.get("k")).toBeUndefined();
  });

  it("evicts the oldest entry past maxEntries", async () => {
    const cache = new InMemoryContentCache({ maxEntries: 2 });
    await cache.set("a", { status: 200, body: 1 }, 60);
    await cache.set("b", { status: 200, body: 2 }, 60);
    await cache.set("c", { status: 200, body: 3 }, 60); // evicts "a"

    expect(await cache.get("a")).toBeUndefined();
    expect(await cache.get("b")).toEqual({ status: 200, body: 2 });
    expect(await cache.get("c")).toEqual({ status: 200, body: 3 });
  });
});

describe("withCache", () => {
  it("serves a second GET from cache without re-fetching", async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      return jsonResponse({ n: calls });
    };
    const cached = withCache(fetch, new InMemoryContentCache(), 60);

    const first = await (await cached("https://x/page")).json();
    const second = await (await cached("https://x/page")).json();

    expect(calls).toBe(1);
    expect(first).toEqual({ n: 1 });
    expect(second).toEqual({ n: 1 }); // same buffered body
  });

  it("isolates entries by Authorization so one caller's content is not served to another", async () => {
    let calls = 0;
    const fetch: FetchLike = async (_url, init) => {
      calls += 1;
      return jsonResponse({ seen: init?.headers?.Authorization ?? "anon" });
    };
    const cached = withCache(fetch, new InMemoryContentCache(), 60);

    await cached("https://x/page", { headers: { Authorization: "Bearer aaa" } });
    const other = await cached("https://x/page", { headers: { Authorization: "Bearer bbb" } });

    expect(calls).toBe(2); // different auth scope = cache miss
    expect(await other.json()).toEqual({ seen: "Bearer bbb" });
  });

  it("coalesces concurrent same-key misses into one underlying fetch", async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      // Resolve after a macrotask so all 5 callers miss the not-yet-set cache.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return jsonResponse({ n: calls });
    };
    const cached = withCache(fetch, new InMemoryContentCache(), 60);

    const results = await Promise.all(Array.from({ length: 5 }, () => cached("https://x/page")));

    expect(calls).toBe(1); // single-flight: one fetch shared across all 5
    for (const response of results) {
      expect(await response.json()).toEqual({ n: 1 });
    }
  });

  it("caches non-OK responses briefly so repeated calls do not re-hit the source", async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      return jsonResponse({ err: true }, 404);
    };
    const cached = withCache(fetch, new InMemoryContentCache(), 60);

    const first = await cached("https://x/page");
    const second = await cached("https://x/page");

    expect(calls).toBe(1); // negative cached → second call served from cache
    expect(first.status).toBe(404);
    expect(first.ok).toBe(false);
    expect(second.status).toBe(404);
    expect(second.ok).toBe(false);
  });

  it("re-fetches a non-OK response after the negative TTL elapses", async () => {
    let clock = 1_000;
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      return jsonResponse({ err: true }, 404);
    };
    // 1s positive TTL, 1s negative TTL, clock-controlled cache + withCache clock.
    const cache = new InMemoryContentCache({ now: () => clock });
    const cached = withCache(fetch, cache, 60, 1, 60, () => clock);

    await cached("https://x/page");
    expect(calls).toBe(1);

    clock += 1_001; // past the 1s negative TTL → entry expired
    await cached("https://x/page");
    expect(calls).toBe(2); // re-fetched
  });

  it("serves a stale OK entry synchronously and refreshes once in the background", async () => {
    let clock = 1_000;
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      return jsonResponse({ n: calls });
    };
    // ttl=10s fresh, +10s stale window; shared clock for cache and withCache.
    const cache = new InMemoryContentCache({ now: () => clock });
    const cached = withCache(fetch, cache, 10, 30, 10, () => clock);

    const first = await (await cached("https://x/page")).json();
    expect(first).toEqual({ n: 1 });
    expect(calls).toBe(1);

    clock += 11_000; // past freshUntil (10s) but within fresh+stale (20s)
    // Stale read returns the LAST-GOOD body synchronously (before refresh runs).
    const stale = await (await cached("https://x/page")).json();
    expect(stale).toEqual({ n: 1 }); // served stale, not the refreshed value
    expect(calls).toBe(2); // exactly one background refresh fired

    // Let the background refresh settle, then a fresh read sees the new value.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const refreshed = await (await cached("https://x/page")).json();
    expect(refreshed).toEqual({ n: 2 });
    expect(calls).toBe(2); // still fresh after refresh → no extra fetch
  });

  it("does not cache non-GET methods", async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      return jsonResponse({ ok: true });
    };
    const cached = withCache(fetch, new InMemoryContentCache(), 60);

    await cached("https://x/page", { method: "POST" });
    await cached("https://x/page", { method: "POST" });
    expect(calls).toBe(2);
  });
});

describe("createSourceContentCache", () => {
  it("returns the in-memory default when no Valkey URL is configured", async () => {
    const cache = await createSourceContentCache({});
    expect(cache).toBeInstanceOf(InMemoryContentCache);
  });
});

describe("ResilientContentCache", () => {
  const VALUE: CachedResponse = { status: 200, body: "ok" };

  // The transition logs (warn on degrade, info on recover) are operational
  // noise in tests — silence them and assert behaviour instead.
  afterEach(() => vi.restoreAllMocks());
  const silenceLogs = () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  };

  const alwaysDown: SourceContentCache = {
    async get() {
      throw new Error("valkey unreachable");
    },
    async set() {
      throw new Error("valkey unreachable");
    },
  };

  it("serves from the primary while it is healthy, leaving the fallback untouched", async () => {
    const primary = new InMemoryContentCache();
    const fallback = new InMemoryContentCache();
    const cache = new ResilientContentCache(primary, fallback);

    await cache.set("k", VALUE, 60);
    expect(await cache.get("k")).toEqual(VALUE);
    expect(await primary.get("k")).toEqual(VALUE);
    expect(await fallback.get("k")).toBeUndefined();
  });

  it("degrades reads and writes to the in-memory fallback when the primary throws", async () => {
    silenceLogs();
    const fallback = new InMemoryContentCache();
    const cache = new ResilientContentCache(alwaysDown, fallback);

    await cache.set("k", VALUE, 60);
    expect(await fallback.get("k")).toEqual(VALUE);
    expect(await cache.get("k")).toEqual(VALUE);
  });

  it("returns to the primary once it recovers", async () => {
    silenceLogs();
    const primary = new InMemoryContentCache();
    const fallback = new InMemoryContentCache();
    let down = true;
    const flaky: SourceContentCache = {
      async get(key) {
        if (down) throw new Error("down");
        return primary.get(key);
      },
      async set(key, value, ttl) {
        if (down) throw new Error("down");
        return primary.set(key, value, ttl);
      },
    };
    const cache = new ResilientContentCache(flaky, fallback);

    await cache.set("degraded", VALUE, 60);
    expect(await fallback.get("degraded")).toEqual(VALUE);

    down = false;
    await cache.set("recovered", VALUE, 60);
    expect(await primary.get("recovered")).toEqual(VALUE);
    expect(await fallback.get("recovered")).toBeUndefined();
  });

  it("logs once on degrade and once on recovery, not per request", async () => {
    const cacheLog = logger("cache");
    const warn = vi.spyOn(cacheLog, "warn").mockImplementation((() => {}) as never);
    const info = vi.spyOn(cacheLog, "info").mockImplementation((() => {}) as never);
    const primary = new InMemoryContentCache();
    let down = true;
    const flaky: SourceContentCache = {
      async get(key) {
        if (down) throw new Error("down");
        return primary.get(key);
      },
      async set(key, value, ttl) {
        if (down) throw new Error("down");
        return primary.set(key, value, ttl);
      },
    };
    const cache = new ResilientContentCache(flaky, new InMemoryContentCache());

    await cache.get("a");
    await cache.get("b");
    expect(warn).toHaveBeenCalledTimes(1);

    down = false;
    await cache.get("c");
    await cache.get("d");
    expect(info).toHaveBeenCalledTimes(1);
  });
});
