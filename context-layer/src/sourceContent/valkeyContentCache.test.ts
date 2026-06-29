import { describe, expect, it } from "vitest";
import type { CachedResponse } from "./sourceContentCache";
import { ValkeyContentCache, parseValkeyUrl } from "./valkeyContentCache";

describe("parseValkeyUrl", () => {
  it("enables TLS for rediss:// and defaults the port", () => {
    expect(parseValkeyUrl("rediss://cache.example.com")).toEqual({
      host: "cache.example.com",
      port: 6379,
      useTLS: true,
    });
  });

  it("leaves TLS off for redis:// and keeps an explicit port", () => {
    expect(parseValkeyUrl("redis://localhost:6380")).toEqual({
      host: "localhost",
      port: 6380,
      useTLS: false,
    });
  });
});

/**
 * A Map-backed stand-in for the GLIDE client. Records the expiry option so we
 * can assert the adapter translates `ttlSeconds` into GLIDE's SetOptions shape.
 */
function fakeGlideClient() {
  const store = new Map<string, string>();
  const expiries: { key: string; type: unknown; count: number }[] = [];
  return {
    expiries,
    client: {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async set(key: string, value: string, options: { expiry: { type: unknown; count: number } }) {
        store.set(key, value);
        expiries.push({ key, ...options.expiry });
      },
      close() {},
    },
  };
}

const SECONDS = Symbol("seconds");
const VALUE: CachedResponse = { status: 200, body: { hello: "world" } };

describe("ValkeyContentCache (injected client)", () => {
  it("round-trips a value through set/get", async () => {
    const fake = fakeGlideClient();
    const cache = new ValkeyContentCache({
      url: "rediss://cache.example.com",
      client: fake.client,
      secondsUnit: SECONDS,
    });

    await cache.set("k", VALUE, 120);
    expect(await cache.get("k")).toEqual(VALUE);
  });

  it("sets the TTL as a GLIDE seconds-expiry option", async () => {
    const fake = fakeGlideClient();
    const cache = new ValkeyContentCache({
      url: "rediss://cache.example.com",
      client: fake.client,
      secondsUnit: SECONDS,
    });

    await cache.set("k", VALUE, 90);
    expect(fake.expiries).toEqual([{ key: "k", type: SECONDS, count: 90 }]);
  });

  it("treats a missing key as undefined", async () => {
    const fake = fakeGlideClient();
    const cache = new ValkeyContentCache({
      url: "rediss://cache.example.com",
      client: fake.client,
      secondsUnit: SECONDS,
    });

    expect(await cache.get("absent")).toBeUndefined();
  });
});

/**
 * Integration test against a real Valkey/ElastiCache, exercising the lazy
 * `@valkey/valkey-glide` import and a true network round-trip. Skipped unless
 * `CACHE_VALKEY_URL` is set (and the GLIDE package is installed) — e.g.
 *   CACHE_VALKEY_URL=redis://localhost:6379 pnpm --filter @atlas/context-layer test
 */
const liveUrl = process.env.CACHE_VALKEY_URL;

describe.skipIf(!liveUrl)("ValkeyContentCache (live server)", () => {
  it("stores and reads back a value, and expires it", async () => {
    const cache = new ValkeyContentCache({ url: liveUrl as string });
    const key = `atlas-cache-test:${process.pid}`;

    await cache.set(key, VALUE, 1);
    expect(await cache.get(key)).toEqual(VALUE);

    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(await cache.get(key)).toBeUndefined();
  });
});
