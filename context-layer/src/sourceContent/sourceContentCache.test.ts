import { describe, expect, it } from "vitest";
import type { FetchLike } from "../resolvers/resolverTypes";
import {
  InMemoryContentCache,
  createSourceContentCache,
  type SourceContentCache,
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

  it("cancels one waiter without aborting shared single-flight work", async () => {
    let resolveFetch!: (response: Awaited<ReturnType<FetchLike>>) => void;
    let calls = 0;
    let underlyingSignal: AbortSignal | undefined;
    const fetch: FetchLike = async (_url, init) => {
      calls += 1;
      underlyingSignal = init?.signal;
      return new Promise((resolve) => {
        resolveFetch = resolve;
      });
    };
    const cached = withCache(fetch, new InMemoryContentCache(), 60);
    const firstController = new AbortController();
    const secondController = new AbortController();

    const first = cached("https://x/page", { signal: firstController.signal });
    const second = cached("https://x/page", { signal: secondController.signal });
    firstController.abort(new DOMException("Navigation superseded", "AbortError"));

    await expect(first).rejects.toMatchObject({ name: "AbortError" });
    resolveFetch(jsonResponse({ ok: true }));
    await expect(second).resolves.toMatchObject({ status: 200 });
    expect(calls).toBe(1);
    expect(underlyingSignal).toBeUndefined();
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
    // 1s negative TTL, clock-controlled cache + withCache clock.
    const cache = new InMemoryContentCache({ now: () => clock });
    const cached = withCache(fetch, cache, 60, 1, () => clock);

    await cached("https://x/page");
    expect(calls).toBe(1);

    clock += 1_001; // past the 1s negative TTL → entry expired
    await cached("https://x/page");
    expect(calls).toBe(2); // re-fetched
  });

  it("waits for a fresh source response after an OK entry expires", async () => {
    let clock = 1_000;
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      return jsonResponse({ n: calls });
    };
    // The hard TTL is shared by the storage adapter and the decorator.
    const cache = new InMemoryContentCache({ now: () => clock });
    const cached = withCache(fetch, cache, 10, 30, () => clock);

    const first = await (await cached("https://x/page")).json();
    expect(first).toEqual({ n: 1 });
    expect(calls).toBe(1);

    clock += 10_001; // past the hard TTL
    const refreshed = await (await cached("https://x/page")).json();
    expect(refreshed).toEqual({ n: 2 });
    expect(calls).toBe(2); // expired content was not replayed
  });

  it("bypasses a failing cache backend without failing the live request", async () => {
    let calls = 0;
    const cache: SourceContentCache = {
      get: async () => {
        throw new Error("cache unavailable");
      },
      set: async () => {
        throw new Error("cache unavailable");
      },
    };
    const fetch: FetchLike = async () => jsonResponse({ n: ++calls });
    const cached = withCache(fetch, cache, 60);

    expect(await (await cached("https://x/page")).json()).toEqual({ n: 1 });
    expect(await (await cached("https://x/page")).json()).toEqual({ n: 2 });
    expect(calls).toBe(2); // cache failure never changes source authority
  });

  it("normalizes a lower-case GET before applying the cache policy", async () => {
    let calls = 0;
    const fetch: FetchLike = async () => jsonResponse({ n: ++calls });
    const cached = withCache(fetch, new InMemoryContentCache(), 60);

    await cached("https://x/page", { method: "get" });
    await cached("https://x/page", { method: "GET" });

    expect(calls).toBe(1);
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

  it("lets a version-aware source bypass the generic cache without leaking the marker", async () => {
    let calls = 0;
    const seenHeaders: Record<string, string>[] = [];
    const fetch: FetchLike = async (_url, init) => {
      calls += 1;
      seenHeaders.push(init?.headers ?? {});
      return jsonResponse({ n: calls });
    };
    const cached = withCache(fetch, new InMemoryContentCache(), 60);
    const init = {
      headers: {
        Authorization: "Bearer source-token",
        "x-atlas-source-cache-bypass": "true",
      },
    };

    await cached("https://x/page", init);
    await cached("https://x/page", init);

    expect(calls).toBe(2);
    expect(seenHeaders).toEqual([
      { Authorization: "Bearer source-token" },
      { Authorization: "Bearer source-token" },
    ]);
  });
});

describe("createSourceContentCache", () => {
  it("returns the in-memory default when no Valkey URL is configured", async () => {
    const cache = await createSourceContentCache({});
    expect(cache).toBeInstanceOf(InMemoryContentCache);
  });
});
