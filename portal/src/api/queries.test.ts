import { describe, expect, it, vi } from "vitest";

const client = vi.hoisted(() => ({
  fetchPortalResourceCatalog: vi.fn(async () => ({ resources: [] })),
}));

vi.mock("./portalContextApiClient", () => client);

import { resourceCatalogQueryOptions } from "./queries";

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
});
