import { describe, expect, it, vi } from "vitest";
import { serveRootSnapshots } from "./serveSnapshots";
import { InMemorySnapshotStore } from "./snapshotStore";
import { InMemoryEventsRepository } from "../repositories/eventsRepository";
import { createTestResolutionContext } from "../resolvers/testResolutionContext";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import type { LandingZoneAvailability } from "@atlas/schema";

/**
 * T2a — the composition/brief read path serves from the shared snapshot store:
 * a warm root serves with ZERO crawls, and a cold burst crawls each root ONCE
 * (the module-level single-flight coalesces concurrent misses). Public-safe
 * fictional data; terraform/security roots are unconfigured (env `{}`) so this
 * isolates the availability crawl count.
 */

function zone(id: string, cloud: string, available: boolean): LandingZoneAvailability {
  return {
    id,
    name: id.toUpperCase(),
    cloud,
    dataStatus: available ? "available" : "not-available",
    locations: [],
    services: available ? [{ id: "vision", name: "Vision", domain: "AI" }] : [],
  } as unknown as LandingZoneAvailability;
}

/** A crawl-counting availability spine (every `getZones` is one source hit). */
function countingProvider() {
  const calls = { getZones: 0 };
  const provider: AvailabilityProvider = {
    async getZones() {
      calls.getZones += 1;
      return [zone("awsf", "aws", true), zone("awsc", "aws", false), zone("azure", "azure", false)];
    },
    listServices: vi.fn().mockResolvedValue([]),
  };
  return { provider, calls };
}

async function serveOnce(store: InMemorySnapshotStore, provider: AvailabilityProvider) {
  const ctx = await createTestResolutionContext();
  return serveRootSnapshots({
    ctx,
    availabilityProvider: provider,
    env: {},
    store,
    events: new InMemoryEventsRepository(),
  });
}

describe("serveRootSnapshots (T2a)", () => {
  it("a cold burst crawls each root once (single-flight coalescing)", async () => {
    const single = countingProvider();
    await serveOnce(new InMemorySnapshotStore(), single.provider);
    const singlePassCrawls = single.calls.getZones;
    expect(singlePassCrawls).toBeGreaterThan(0);

    // Two concurrent cold passes on the SHARED path (no injected store, so the
    // module-level single-flight is active — FIX 5 bypasses coalescing ONLY for
    // injected stores) must NOT double the crawl count.
    const burst = countingProvider();
    const ctx = await createTestResolutionContext();
    const env = { TERRAFORM_ORG: "cold-burst-shared" };
    await Promise.all([
      serveRootSnapshots({ ctx, availabilityProvider: burst.provider, env }),
      serveRootSnapshots({ ctx, availabilityProvider: burst.provider, env }),
    ]);
    expect(burst.calls.getZones).toBe(singlePassCrawls);
  });

  it("a warm read serves from the snapshot with zero crawls", async () => {
    const { provider, calls } = countingProvider();
    const store = new InMemorySnapshotStore();
    await serveOnce(store, provider); // cold pass seeds every root
    const afterCold = calls.getZones;
    expect(afterCold).toBeGreaterThan(0);

    await serveOnce(store, provider); // warm pass
    expect(calls.getZones).toBe(afterCold); // no additional crawl
  });

  it("serves the available zone's services and the honest-empty ones", async () => {
    const { provider } = countingProvider();
    const { snapshots } = await serveOnce(new InMemorySnapshotStore(), provider);
    const awsf = snapshots.find((s) => s.rootId === "availability:awsf");
    expect(awsf?.parse.kind).toBe("availability");
    if (awsf?.parse.kind === "availability") {
      expect(awsf.parse.services.map((s) => s.slug)).toEqual(["aws/vision"]);
    }
  });

  it("an injected-store serve does not coalesce onto an in-flight shared-path crawl (FIX 5)", async () => {
    // A gated provider whose crawl stays IN FLIGHT until we release it, so the
    // module-level single-flight holds a pending entry for this env-hash.
    let releaseShared: () => void = () => {};
    const sharedGate = new Promise<void>((resolve) => {
      releaseShared = resolve;
    });
    const shared = { calls: 0 };
    const sharedProvider: AvailabilityProvider = {
      async getZones() {
        shared.calls += 1;
        await sharedGate;
        return [zone("awsf", "aws", true)];
      },
      listServices: vi.fn().mockResolvedValue([]),
    };
    const injected = { calls: 0 };
    const injectedProvider: AvailabilityProvider = {
      async getZones() {
        injected.calls += 1;
        return [zone("awsf", "aws", true)];
      },
      listServices: vi.fn().mockResolvedValue([]),
    };

    const ctx = await createTestResolutionContext();
    const env = { TERRAFORM_ORG: "fix5-injected-vs-shared" };

    // Start the SHARED-path crawl (no `store` ⇒ coalescing on `envHash:rootId`).
    const sharedRun = serveRootSnapshots({ ctx, availabilityProvider: sharedProvider, env });
    // Wait until the shared crawl has actually begun (its getZones fired).
    while (shared.calls === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // While the shared crawl is in flight, an injected-store serve MUST crawl its
    // OWN provider — never coalesce onto the shared spine (the seam's purpose).
    await serveRootSnapshots({
      ctx,
      availabilityProvider: injectedProvider,
      env,
      store: new InMemorySnapshotStore(),
      events: new InMemoryEventsRepository(),
    });
    expect(injected.calls).toBeGreaterThan(0);

    releaseShared();
    await sharedRun;
  });
});
