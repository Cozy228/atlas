import { describe, expect, it } from "vitest";
import type { FetchLike } from "../resolvers/resolverTypes";
import { InMemoryContentCache, createSourceContentCache, withCache } from "./sourceContentCache";

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

  it("does not cache non-OK responses", async () => {
    let calls = 0;
    const fetch: FetchLike = async () => {
      calls += 1;
      return jsonResponse({ err: true }, 503);
    };
    const cached = withCache(fetch, new InMemoryContentCache(), 60);

    await cached("https://x/page");
    await cached("https://x/page");
    expect(calls).toBe(2);
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
