import { describe, expect, it, vi } from "vitest";
import {
  createSnapshotStore,
  sharedSnapshotStore,
  snapshotEnvHash,
  SNAPSHOT_STORE_RETRY_MS,
} from "./snapshotStoreFactory";
import { InMemorySnapshotStore } from "./snapshotStore";
import { ValkeySnapshotStore } from "./valkeySnapshotStore";

/**
 * T1b — the factory selects the store at CONSTRUCTION time (decision 5):
 * `CACHE_VALKEY_URL` set ⇒ Valkey; unset ⇒ in-memory; a connection failure at
 * construction falls back to in-memory (with a loud log). A runtime op error is
 * handled inside the store (see `valkeySnapshotStore.test.ts`), never here.
 * FIX 3 adds the credential-env hash inputs; FIX 4 adds the transient-outage
 * retry on the shared store.
 */

/** A minimal stand-in for a connected GLIDE cluster client. */
function fakeGlideClient() {
  return {
    get: vi.fn().mockResolvedValue(null),
    invokeScript: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue(new Set<string>()),
    close: vi.fn(),
  };
}

describe("createSnapshotStore (T1b)", () => {
  it("returns the in-memory store when CACHE_VALKEY_URL is unset", async () => {
    const store = await createSnapshotStore({});
    expect(store).toBeInstanceOf(InMemorySnapshotStore);
  });

  it("returns the Valkey store when CACHE_VALKEY_URL is set (GLIDE default)", async () => {
    const createClient = vi.fn().mockResolvedValue(fakeGlideClient());
    const store = await createSnapshotStore(
      { CACHE_VALKEY_URL: "rediss://cache.example.com" },
      { createClient },
    );
    expect(store).toBeInstanceOf(ValkeySnapshotStore);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it("falls back to in-memory when the connection fails at construction", async () => {
    const createClient = vi.fn().mockRejectedValue(new Error("ENOTFOUND cache.example.com"));
    const store = await createSnapshotStore(
      { CACHE_VALKEY_URL: "rediss://cache.example.com" },
      { createClient },
    );
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(store).toBeInstanceOf(InMemorySnapshotStore);
  });
});

describe("sharedSnapshotStore (T1b memoization)", () => {
  it("memoizes per env-hash: same env ⇒ one instance, changed env ⇒ rebuilt", async () => {
    const a1 = await sharedSnapshotStore({ TERRAFORM_ORG: "org-a" });
    const a2 = await sharedSnapshotStore({ TERRAFORM_ORG: "org-a" });
    expect(a1).toBe(a2);

    const b = await sharedSnapshotStore({ TERRAFORM_ORG: "org-b" });
    expect(b).not.toBe(a1);
  });
});

describe("snapshotEnvHash credential inputs (FIX 3)", () => {
  it("changes when a credential env rotates (tokens/emails folded into the hash)", () => {
    const base = { TERRAFORM_ORG: "org", CONFLUENCE_BASE_URL: "https://c.example" };
    const h0 = snapshotEnvHash(base);
    expect(snapshotEnvHash({ ...base, TERRAFORM_TOKEN: "tf-1" })).not.toBe(h0);
    expect(snapshotEnvHash({ ...base, CONFLUENCE_TOKEN: "tok-1" })).not.toBe(h0);
    expect(snapshotEnvHash({ ...base, CONFLUENCE_EMAIL: "a@example" })).not.toBe(h0);
    expect(snapshotEnvHash({ ...base, CONFLUENCE_SECURITY_TOKEN: "s-1" })).not.toBe(h0);
    expect(snapshotEnvHash({ ...base, CONFLUENCE_SECURITY_EMAIL: "s@example" })).not.toBe(h0);
  });
});

describe("sharedSnapshotStore transient-outage retry (FIX 4)", () => {
  it("a degraded fallback recovers to the Valkey store after the retry window", async () => {
    const createClient = vi
      .fn()
      .mockRejectedValueOnce(new Error("ENOTFOUND"))
      .mockResolvedValue(fakeGlideClient());
    const env = { CACHE_VALKEY_URL: "rediss://cache.example.com", TERRAFORM_ORG: "recover-a" };
    let now = 1_000;

    // First construction fails ⇒ degraded in-memory fallback.
    const first = await sharedSnapshotStore(env, () => now, { createClient });
    expect(first).toBeInstanceOf(InMemorySnapshotStore);

    // Within the window: no retry, the SAME instance is served.
    now += SNAPSHOT_STORE_RETRY_MS - 1;
    const within = await sharedSnapshotStore(env, () => now, { createClient });
    expect(within).toBe(first);
    expect(createClient).toHaveBeenCalledTimes(1);

    // Past the window: the retry succeeds ⇒ durable Valkey store.
    now += 2;
    const recovered = await sharedSnapshotStore(env, () => now, { createClient });
    expect(recovered).toBeInstanceOf(ValkeySnapshotStore);
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it("a still-failing retry keeps the SAME in-memory instance (no cold-storm)", async () => {
    const createClient = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
    const env = { CACHE_VALKEY_URL: "rediss://cache.example.com", TERRAFORM_ORG: "recover-b" };
    let now = 1_000;

    const firstStore = await sharedSnapshotStore(env, () => now, { createClient });
    expect(firstStore).toBeInstanceOf(InMemorySnapshotStore);

    now += SNAPSHOT_STORE_RETRY_MS + 1;
    const retried = await sharedSnapshotStore(env, () => now, { createClient });
    // A retry was attempted (construction ran again) but the fallback instance is
    // reused rather than cold-swapped for a fresh one.
    expect(createClient).toHaveBeenCalledTimes(2);
    expect(retried).toBe(firstStore);
  });

  it("never retries when CACHE_VALKEY_URL is unset (plain memoized in-memory)", async () => {
    const env = { TERRAFORM_ORG: "unset-url" };
    let now = 1_000;
    const first = await sharedSnapshotStore(env, () => now);
    expect(first).toBeInstanceOf(InMemorySnapshotStore);

    // Advance well past the retry window — an unset-URL entry must not rebuild.
    now += SNAPSHOT_STORE_RETRY_MS * 10;
    const second = await sharedSnapshotStore(env, () => now);
    expect(second).toBe(first);
  });
});
