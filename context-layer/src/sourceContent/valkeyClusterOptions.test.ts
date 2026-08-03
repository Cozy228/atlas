import { describe, expect, it, vi } from "vitest";

const clusterMock = vi.hoisted(() => ({
  constructor: vi.fn(),
  connect: vi.fn(async () => undefined),
  disconnect: vi.fn(),
  get: vi.fn(async () => null),
  quit: vi.fn(async () => "OK"),
  set: vi.fn(async () => "OK"),
}));

vi.mock("iovalkey", () => ({
  Cluster: class {
    constructor(...args: unknown[]) {
      clusterMock.constructor(...args);
    }
    connect = clusterMock.connect;
    disconnect = clusterMock.disconnect;
    get = clusterMock.get;
    quit = clusterMock.quit;
    set = clusterMock.set;
  },
}));

import { ValkeyContentCache } from "./valkeyContentCache";

describe("iovalkey cluster defaults", () => {
  it("bounds optional-cache connection and command waits", async () => {
    const cache = new ValkeyContentCache({
      cacheName: "atlas-production-content-cache",
      region: "us-east-1",
      url: "rediss://configuration.example.com:6379",
      userId: "atlas-portal",
      tokenProvider: async () => "iam-token",
    });

    await cache.get("key");

    expect(clusterMock.constructor).toHaveBeenCalledWith(
      [{ host: "configuration.example.com", port: 6379 }],
      expect.objectContaining({
        enableOfflineQueue: false,
        lazyConnect: true,
        clusterRetryStrategy: expect.any(Function),
        redisOptions: expect.objectContaining({
          commandTimeout: 1_000,
          connectTimeout: 2_000,
          maxRetriesPerRequest: 1,
          password: "iam-token",
          tls: {},
          username: "atlas-portal",
        }),
      }),
    );
    const options = clusterMock.constructor.mock.calls[0]?.[1] as {
      clusterRetryStrategy: (attempt: number) => number | null;
    };
    expect(options.clusterRetryStrategy(1)).toBeNull();
  });
});
