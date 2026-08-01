import { afterEach, describe, expect, it, vi } from "vitest";

const valkeyLifecycle = vi.hoisted(() => {
  let releaseImport!: () => void;
  const importGate = new Promise<void>((resolve) => {
    releaseImport = resolve;
  });
  return {
    close: vi.fn(),
    importGate,
    instances: 0,
    releaseImport,
  };
});

vi.mock("./valkeyContentCache", async () => {
  await valkeyLifecycle.importGate;
  return {
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
  };
});

vi.mock("./iovalkeyContentCache", () => ({
  IoValkeyContentCache: class {
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

  it("atomically resets a pending shared cache and closes each instance once", async () => {
    const firstContext = cachedResolutionContext({
      CACHE_VALKEY_URL: "redis://first-cache.example.com",
    });
    await Promise.resolve();
    const firstClose = closeSourceContentCache();
    const duplicateClose = closeSourceContentCache();
    const secondContext = cachedResolutionContext({
      CACHE_VALKEY_CLIENT: "iovalkey",
      CACHE_VALKEY_URL: "redis://second-cache.example.com",
    });

    valkeyLifecycle.releaseImport();
    await Promise.all([firstContext, firstClose, duplicateClose, secondContext]);

    expect({
      closeCalls: valkeyLifecycle.close.mock.calls.length,
      instances: valkeyLifecycle.instances,
    }).toEqual({ closeCalls: 1, instances: 2 });

    await closeSourceContentCache();
    await closeSourceContentCache();
    expect(valkeyLifecycle.close).toHaveBeenCalledTimes(2);
  });
});
