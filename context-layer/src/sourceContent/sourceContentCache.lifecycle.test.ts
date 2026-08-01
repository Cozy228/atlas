import { afterEach, describe, expect, it, vi } from "vitest";

const valkeyLifecycle = vi.hoisted(() => ({ close: vi.fn(), instances: 0 }));

vi.mock("./valkeyContentCache", () => ({
  ValkeyContentCache: class {
    constructor() {
      valkeyLifecycle.instances += 1;
    }

    async get() {
      return undefined;
    }

    async set() {}

    close() {
      valkeyLifecycle.close();
    }
  },
}));

import { cachedResolutionContext, closeSourceContentCache } from "./sourceContentCache";

afterEach(async () => {
  await closeSourceContentCache();
  valkeyLifecycle.instances = 0;
  valkeyLifecycle.close.mockClear();
});

describe("closeSourceContentCache", () => {
  it("is a no-op before the shared cache is initialized", async () => {
    await closeSourceContentCache();

    expect(valkeyLifecycle.instances).toBe(0);
    expect(valkeyLifecycle.close).not.toHaveBeenCalled();
  });

  it("resets the shared cache and closes each instance once", async () => {
    await cachedResolutionContext({
      CACHE_VALKEY_CACHE_NAME: "first-cache",
      CACHE_VALKEY_REGION: "us-east-1",
      CACHE_VALKEY_URL: "redis://first-cache.example.com",
      CACHE_VALKEY_USER_ID: "atlas-portal",
    });
    await closeSourceContentCache();
    await closeSourceContentCache();
    await cachedResolutionContext({
      CACHE_VALKEY_CACHE_NAME: "second-cache",
      CACHE_VALKEY_REGION: "us-east-1",
      CACHE_VALKEY_URL: "redis://second-cache.example.com",
      CACHE_VALKEY_USER_ID: "atlas-portal",
    });

    expect({
      closeCalls: valkeyLifecycle.close.mock.calls.length,
      instances: valkeyLifecycle.instances,
    }).toEqual({ closeCalls: 1, instances: 2 });

    await closeSourceContentCache();
    await closeSourceContentCache();
    expect(valkeyLifecycle.close).toHaveBeenCalledTimes(2);
  });
});
