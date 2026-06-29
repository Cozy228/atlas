import { describe, expect, it } from "vitest";
import type { FetchLike } from "../resolvers/resolverTypes";
import { CONFLUENCE_PAGES, DEV_CONFLUENCE_BASE_URL } from "./fixtures";

/**
 * G0 GATE — proves the load-bearing MSW seam before anything else is built:
 *
 *  1. The Node-mode `setupServer` (started by `devMocks/setup.ts` in `beforeAll`)
 *     intercepts outbound source-system fetches and answers from the fixtures.
 *  2. A LATE-BOUND `(i,init) => globalThis.fetch(i,init)` closure — the exact
 *     shape application code uses — is intercepted even though the closure object
 *     is created at module-eval time, BEFORE `server.listen()` runs. This is the
 *     mandatory mitigation for Risk #1 ("late-bound fetch or MSW misses the patch").
 *
 * The companion "zero `msw` in the prod bundle" half of the gate is proven out of
 * band by building the lambda and grepping the bundle (see plan §Verification).
 */

// Created at module eval — i.e. BEFORE the beforeAll() that calls server.listen().
// It re-reads globalThis.fetch on every call, so the later patch is picked up.
const lateBoundFetch: FetchLike = (input, init) =>
  globalThis.fetch(input, init as RequestInit) as unknown as ReturnType<FetchLike>;

const pageUrl = (id: string) =>
  `${DEV_CONFLUENCE_BASE_URL}/wiki/api/v2/pages/${id}?body-format=storage`;

describe("devMocks MSW seam (G0 gate)", () => {
  it("intercepts a late-bound globalThis.fetch and returns the page fixture", async () => {
    const response = await lateBoundFetch(pageUrl("100001"), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const page = (await response.json()) as (typeof CONFLUENCE_PAGES)["100001"];
    expect(page.id).toBe("100001");
    expect(page.title).toBe(CONFLUENCE_PAGES["100001"].title);
    expect(page.body.storage.value).toContain("<h2>Network</h2>");
  });

  it("intercepts a direct globalThis.fetch call too", async () => {
    const response = await globalThis.fetch(pageUrl("100001"));
    expect(response.status).toBe(200);
  });

  it("returns 404 for an unmocked page id (honest gap, not a fake fallback)", async () => {
    const response = await lateBoundFetch(pageUrl("999999"));
    expect(response.status).toBe(404);
  });
});
