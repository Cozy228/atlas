import { describe, expect, it, vi } from "vitest";

import type { CachedResponse } from "./sourceContentCache";
import { ValkeyContentCache } from "./valkeyContentCache";

const VALUE: CachedResponse = { status: 200, body: { hello: "world" } };

function fakeClusterClient() {
  const store = new Map<string, string>();
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    quit: vi.fn(async () => "OK"),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
  };
}

describe("ValkeyContentCache", () => {
  it("uses a cluster client with the ElastiCache IAM configuration", async () => {
    const client = fakeClusterClient();
    const clientFactory = vi.fn(async () => client);
    const tokenProvider = vi.fn(async () => "iam-token");
    const cache = new ValkeyContentCache({
      cacheName: "atlas-production-content-cache",
      region: "us-east-1",
      url: "rediss://configuration.example.com:6379",
      userId: "atlas-portal",
      clientFactory,
      tokenProvider,
    });

    await cache.set("k", VALUE, 90);
    expect(await cache.get("k")).toEqual(VALUE);
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(clientFactory).toHaveBeenCalledWith({
      host: "configuration.example.com",
      password: "iam-token",
      port: 6379,
      username: "atlas-portal",
    });
    expect(client.set).toHaveBeenCalledWith("k", JSON.stringify(VALUE), "EX", 90);
  });

  it("shares one cluster connection across concurrent operations and closes it", async () => {
    const client = fakeClusterClient();
    let resolveClient: ((value: typeof client) => void) | undefined;
    const clientFactory = vi.fn(
      () => new Promise<typeof client>((resolve) => (resolveClient = resolve)),
    );
    const cache = new ValkeyContentCache({
      cacheName: "atlas-production-content-cache",
      region: "us-east-1",
      url: "rediss://configuration.example.com:6379",
      userId: "atlas-portal",
      clientFactory,
      tokenProvider: async () => "iam-token",
    });

    const first = cache.get("one");
    const second = cache.get("two");
    await Promise.resolve();
    expect(clientFactory).toHaveBeenCalledTimes(1);
    resolveClient?.(client);
    await Promise.all([first, second]);
    await cache.close();

    expect(client.quit).toHaveBeenCalledTimes(1);
  });

  it("rotates the cluster before the 15-minute IAM token expires", async () => {
    const firstClient = fakeClusterClient();
    const secondClient = fakeClusterClient();
    const clients = [firstClient, secondClient];
    const clientFactory = vi.fn(async () => clients.shift() ?? secondClient);
    const tokenProvider = vi
      .fn<() => Promise<string>>()
      .mockResolvedValueOnce("first-token")
      .mockResolvedValueOnce("second-token");
    let now = 0;
    const cache = new ValkeyContentCache({
      cacheName: "atlas-production-content-cache",
      region: "us-east-1",
      url: "rediss://configuration.example.com:6379",
      userId: "atlas-portal",
      clientFactory,
      tokenProvider,
      now: () => now,
    });

    await cache.get("first");
    now = 14 * 60_000;
    await cache.get("second");

    expect(tokenProvider).toHaveBeenCalledTimes(2);
    expect(clientFactory).toHaveBeenNthCalledWith(2, {
      host: "configuration.example.com",
      password: "second-token",
      port: 6379,
      username: "atlas-portal",
    });
    expect(firstClient.quit).toHaveBeenCalledTimes(1);
  });

  it("drops a failed cluster connection so the next operation reconnects", async () => {
    const failedClient = fakeClusterClient();
    failedClient.get.mockRejectedValue(new Error("connection closed"));
    const recoveredClient = fakeClusterClient();
    recoveredClient.get.mockResolvedValue(JSON.stringify(VALUE));
    const clients = [failedClient, recoveredClient];
    const clientFactory = vi.fn(async () => clients.shift() ?? recoveredClient);
    const cache = new ValkeyContentCache({
      cacheName: "atlas-production-content-cache",
      region: "us-east-1",
      url: "rediss://configuration.example.com:6379",
      userId: "atlas-portal",
      clientFactory,
      tokenProvider: async () => "iam-token",
    });

    await expect(cache.get("first")).rejects.toThrow("connection closed");
    await expect(cache.get("second")).resolves.toEqual(VALUE);

    expect(clientFactory).toHaveBeenCalledTimes(2);
    expect(failedClient.disconnect).toHaveBeenCalledTimes(1);
  });

  it("treats structurally invalid cache values as misses", async () => {
    const client = fakeClusterClient();
    client.get.mockResolvedValue(JSON.stringify({ status: "200", body: { unsafe: true } }));
    const cache = new ValkeyContentCache({
      cacheName: "atlas-production-content-cache",
      region: "us-east-1",
      url: "rediss://configuration.example.com:6379",
      userId: "atlas-portal",
      clientFactory: async () => client,
      tokenProvider: async () => "iam-token",
    });

    await expect(cache.get("invalid")).resolves.toBeUndefined();
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
