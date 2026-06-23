import { describe, expect, it } from "vitest";
import type { CachedResponse } from "./sourceContentCache.js";
import { IoValkeyContentCache } from "./iovalkeyContentCache.js";

/**
 * A Map-backed stand-in for the `iovalkey` client. Records the EX TTL so we can
 * assert the adapter passes `set(key, value, "EX", ttlSeconds)`.
 */
function fakeIoValkeyClient() {
  const store = new Map<string, string>();
  const expiries: { key: string; mode: string; ttl: number }[] = [];
  return {
    expiries,
    client: {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async set(key: string, value: string, mode: "EX", ttl: number) {
        store.set(key, value);
        expiries.push({ key, mode, ttl });
      },
    },
  };
}

const VALUE: CachedResponse = { status: 200, body: { hello: "world" } };

describe("IoValkeyContentCache (injected client)", () => {
  it("round-trips a value through set/get", async () => {
    const fake = fakeIoValkeyClient();
    const cache = new IoValkeyContentCache({
      url: "rediss://cache.example.com",
      client: fake.client,
    });

    await cache.set("k", VALUE, 120);
    expect(await cache.get("k")).toEqual(VALUE);
  });

  it("sets the TTL via the EX option", async () => {
    const fake = fakeIoValkeyClient();
    const cache = new IoValkeyContentCache({
      url: "rediss://cache.example.com",
      client: fake.client,
    });

    await cache.set("k", VALUE, 90);
    expect(fake.expiries).toEqual([{ key: "k", mode: "EX", ttl: 90 }]);
  });

  it("treats a missing key as undefined", async () => {
    const fake = fakeIoValkeyClient();
    const cache = new IoValkeyContentCache({
      url: "rediss://cache.example.com",
      client: fake.client,
    });

    expect(await cache.get("absent")).toBeUndefined();
  });
});

/**
 * Integration test against a real Valkey/ElastiCache via `iovalkey`, exercising
 * the lazy import and a true round-trip. Skipped unless both
 * `ATLAS_CACHE_VALKEY_URL` is set and `ATLAS_CACHE_VALKEY_CLIENT=iovalkey` (the
 * fallback is opt-in), with the `iovalkey` package installed.
 */
const liveUrl = process.env.ATLAS_CACHE_VALKEY_URL;
const ioValkeySelected = process.env.ATLAS_CACHE_VALKEY_CLIENT === "iovalkey";

describe.skipIf(!liveUrl || !ioValkeySelected)("IoValkeyContentCache (live server)", () => {
  it("stores and reads back a value, and expires it", async () => {
    const cache = new IoValkeyContentCache({ url: liveUrl as string });
    const key = `atlas-cache-test:iovalkey:${process.pid}`;

    await cache.set(key, VALUE, 1);
    expect(await cache.get(key)).toEqual(VALUE);

    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(await cache.get(key)).toBeUndefined();
  });
});
