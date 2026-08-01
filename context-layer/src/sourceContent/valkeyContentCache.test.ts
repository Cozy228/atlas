import { describe, expect, it, vi } from "vitest";

import type { CachedResponse } from "./sourceContentCache";
import { ValkeyContentCache } from "./valkeyContentCache";

const VALUE: CachedResponse = { status: 200, body: { hello: "world" } };

function fakeClusterClient() {
  const store = new Map<string, string>();
  return {
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    quit: vi.fn(async () => {}),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
  };
}

describe("ValkeyContentCache", () => {
  it("uses a cluster client with IAM username and token", async () => {
    const client = fakeClusterClient();
    const clientFactory = vi.fn(async () => client);
    const cache = new ValkeyContentCache({
      cacheName: "atlas-production-content-cache",
      region: "us-east-1",
      url: "rediss://configuration.example.com:6379",
      userId: "atlas-portal",
      clientFactory,
      tokenProvider: async () => "signed-token",
    });

    await cache.set("k", VALUE, 90);
    expect(await cache.get("k")).toEqual(VALUE);
    expect(clientFactory).toHaveBeenCalledWith({
      host: "configuration.example.com",
      password: "signed-token",
      port: 6379,
      username: "atlas-portal",
    });
    expect(client.set).toHaveBeenCalledWith("k", JSON.stringify(VALUE), "EX", 90);
  });

  it("rotates the cluster connection before the IAM token expires", async () => {
    let now = 0;
    const first = fakeClusterClient();
    const second = fakeClusterClient();
    const clientFactory = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const tokenProvider = vi.fn().mockResolvedValueOnce("token-1").mockResolvedValueOnce("token-2");
    const cache = new ValkeyContentCache({
      cacheName: "atlas-production-content-cache",
      region: "us-east-1",
      url: "rediss://configuration.example.com:6379",
      userId: "atlas-portal",
      clientFactory,
      now: () => now,
      tokenProvider,
    });

    await cache.get("k");
    now = 14 * 60_000;
    await cache.get("k");

    expect(tokenProvider).toHaveBeenCalledTimes(2);
    expect(first.quit).toHaveBeenCalledTimes(1);
    expect(clientFactory.mock.calls[1]?.[0]).toMatchObject({ password: "token-2" });
  });

  it("requires TLS for IAM authentication", () => {
    expect(
      () =>
        new ValkeyContentCache({
          cacheName: "atlas-production-content-cache",
          region: "us-east-1",
          url: "redis://configuration.example.com:6379",
          userId: "atlas-portal",
        }),
    ).toThrow("must use rediss://");
  });
});
