/**
 * D5 — the Nitro `.md` route is governed (Step 1). The route's default export
 * is invoked directly with a synthetic web `Request` (the current Nitro
 * filesystem-route contract; `handlerRequest` duck-types it). Governance is
 * observed at the wire: the caller Bearer reaches the upstream source fetch,
 * and a repeat render is served from the process-shared content cache.
 *
 * Lives under src/ (not portal/server/) so the portal vitest run and tsconfig
 * pick it up alongside the other server-side tests; the route module is
 * imported by relative path.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DEV_CONFLUENCE_BASE_URL,
  DEV_TERRAFORM_BASE_URL,
  server,
  setDevDiscoveryEnv,
} from "@atlas/context-layer/devMocks";

import renderResourceMarkdownRoute from "../../../server/routes/resources/[...]";

const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  setDevDiscoveryEnv(process.env, { referenceSpace: false });
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

function mdRequest(token: string): Request {
  return new Request("https://portal.example.com/resources/service/aws/textract.md", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("Nitro .md route — governance gate (Step 1)", () => {
  it("D5: a .md render threads the caller Bearer to the upstream source fetch", async () => {
    const token = "fictional-md-caller-token-789";
    const upstreamAuthorization: (string | null)[] = [];
    server.events.on("request:start", ({ request }) => {
      if (
        request.url.startsWith(DEV_TERRAFORM_BASE_URL) ||
        request.url.startsWith(DEV_CONFLUENCE_BASE_URL)
      ) {
        upstreamAuthorization.push(request.headers.get("authorization"));
      }
    });

    try {
      const response = await renderResourceMarkdownRoute(mdRequest(token));
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/markdown");

      // The route must build its context through the factory with the request
      // headers — the opaque Bearer (ADR-0001) rides to the upstream fetch.
      expect(upstreamAuthorization.length).toBeGreaterThan(0);
      expect(upstreamAuthorization).toContain(`Bearer ${token}`);
    } finally {
      server.events.removeAllListeners("request:start");
    }
  });

  it("D5: a repeat .md render is served from the shared content cache (zero upstream re-fetches)", async () => {
    // Distinct token from the test above: its auth-digested cache keys are
    // this test's own, so the first render populates and the second must hit.
    const token = "fictional-md-cache-token-790";
    const first = await renderResourceMarkdownRoute(mdRequest(token));
    expect(first.status).toBe(200);

    const upstreamDuringSecondRender: string[] = [];
    server.events.on("request:start", ({ request }) => {
      if (request.url.startsWith(DEV_TERRAFORM_BASE_URL)) {
        upstreamDuringSecondRender.push(request.url);
      }
    });
    try {
      const second = await renderResourceMarkdownRoute(mdRequest(token));
      expect(second.status).toBe(200);
    } finally {
      server.events.removeAllListeners("request:start");
    }

    expect(upstreamDuringSecondRender).toEqual([]);
  });
});
