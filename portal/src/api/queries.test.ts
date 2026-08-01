import { describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  fetchPortalAnnouncements: vi.fn(async () => []),
  fetchPortalAvailability: vi.fn(async () => ({ zones: [] })),
  fetchPortalGuidance: vi.fn(async () => []),
  fetchPortalLandingZones: vi.fn(async () => []),
  fetchPortalReleases: vi.fn(async () => []),
  fetchPortalResourceCatalog: vi.fn(async () => ({ resources: [] })),
  fetchPortalResourceContext: vi.fn(async () => ({})),
  fetchPortalResourceRecord: vi.fn(async () => ({})),
  fetchPortalSourceDiscovery: vi.fn(async () => ({ sources: [] })),
}));

vi.mock("./portalContextApiClient", () => client);

import {
  announcementsQueryOptions,
  availabilityQueryOptions,
  guidanceQueryOptions,
  landingZonesQueryOptions,
  releaseNotesQueryOptions,
  resourceCatalogQueryOptions,
  resourceContextQueryOptions,
  resourceRecordQueryOptions,
  sourceDiscoveryQueryOptionsFor,
} from "./queries";

describe("Portal query transport", () => {
  it("loads the resource catalog through the browser API client with cancellation", async () => {
    const controller = new AbortController();
    vi.stubGlobal("window", {});
    const queryFn = resourceCatalogQueryOptions.queryFn as (context: {
      signal: AbortSignal;
    }) => Promise<unknown>;

    await queryFn({ signal: controller.signal });

    expect(client.fetchPortalResourceCatalog).toHaveBeenCalledWith({ signal: controller.signal });
    vi.unstubAllGlobals();
  });

  it("loads source discovery through the browser API client", async () => {
    const controller = new AbortController();
    vi.stubGlobal("window", {});
    const queryFn = sourceDiscoveryQueryOptionsFor({ query: "module" }).queryFn as BrowserQueryFn;

    await queryFn({ signal: controller.signal });

    expect(client.fetchPortalSourceDiscovery).toHaveBeenCalledWith(
      { query: "module" },
      { signal: controller.signal },
    );
    vi.unstubAllGlobals();
  });

  it("loads resource metadata and context through the browser API client", async () => {
    const controller = new AbortController();
    const ref = { kind: "service", slug: "aws/textract" };
    vi.stubGlobal("window", {});
    const recordQueryFn = resourceRecordQueryOptions(ref).queryFn as BrowserQueryFn;
    const contextQueryFn = resourceContextQueryOptions(ref).queryFn as BrowserQueryFn;

    await Promise.all([
      recordQueryFn({ signal: controller.signal }),
      contextQueryFn({ signal: controller.signal }),
    ]);

    expect(client.fetchPortalResourceRecord).toHaveBeenCalledWith(ref, {
      signal: controller.signal,
    });
    expect(client.fetchPortalResourceContext).toHaveBeenCalledWith(ref, {
      signal: controller.signal,
    });
    vi.unstubAllGlobals();
  });

  it("loads Portal-only queries through their explicit browser contracts", async () => {
    const controller = new AbortController();
    vi.stubGlobal("window", {});

    for (const options of [
      releaseNotesQueryOptions,
      announcementsQueryOptions,
      guidanceQueryOptions,
      availabilityQueryOptions,
      landingZonesQueryOptions,
    ]) {
      const queryFn = options.queryFn as BrowserQueryFn;
      await queryFn({ signal: controller.signal });
    }

    for (const request of [
      client.fetchPortalReleases,
      client.fetchPortalAnnouncements,
      client.fetchPortalGuidance,
      client.fetchPortalAvailability,
      client.fetchPortalLandingZones,
    ]) {
      expect(request).toHaveBeenCalledWith({ signal: controller.signal });
    }
    vi.unstubAllGlobals();
  });
});

type BrowserQueryFn = (context: { signal: AbortSignal }) => Promise<unknown>;
