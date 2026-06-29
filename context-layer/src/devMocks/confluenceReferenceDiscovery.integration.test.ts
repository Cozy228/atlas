import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { createConfluenceReferenceDiscovery } from "../sourceContent/confluenceReferenceDiscovery";
import { normalizeServiceIdentity } from "../services/serviceIdentityNormalizer";
import type { FetchLike } from "../resolvers/resolverTypes";
import { server } from "./server";
import { DEV_CONFLUENCE_BASE_URL, DEV_CONFLUENCE_SPACE_KEYS } from "./fixtures";

/**
 * Integration: the LIVE Confluence CQL reference-discovery adapter driven through
 * the Node-mode MSW server (no in-code fixture, no injected hand-rolled fetch — the
 * real adapter against a real-shaped HTTP surface). Proves the plan-018 single live
 * reference path: discovery learns which pages EXIST per service via CQL recall +
 * double-hit admission, and degrades honestly on truncation / 4xx / 5xx.
 */

const lateBoundFetch: FetchLike = (input, init) =>
  globalThis.fetch(input, init as RequestInit) as unknown as ReturnType<FetchLike>;

function liveDiscovery() {
  // Fresh adapter per call → fresh in-process cache, so tests stay isolated.
  return createConfluenceReferenceDiscovery(
    {
      baseUrl: DEV_CONFLUENCE_BASE_URL,
      token: "dev-mock-token",
      spaceKeys: DEV_CONFLUENCE_SPACE_KEYS,
    },
    { fetch: lateBoundFetch, now: () => 1_700_000_000_000 },
  );
}

const textract = normalizeServiceIdentity({
  provider: "aws",
  id: "textract",
  name: "Amazon Textract",
});
const s3 = normalizeServiceIdentity({ provider: "aws", id: "s3", name: "Amazon S3" });
const aks = normalizeServiceIdentity({
  provider: "azure",
  id: "aks",
  name: "Azure Kubernetes Service",
});

const searchUrl = `${DEV_CONFLUENCE_BASE_URL}/wiki/rest/api/content/search`;

describe("live reference discovery via MSW CQL (plan 018 G1)", () => {
  it("discovers + admits textract references by doc-type, dropping recalled noise", async () => {
    const result = await liveDiscovery().discover(textract);

    expect(result.status).toBe("fresh");
    expect(result.incomplete).toBe(false);
    const byType = Object.fromEntries(result.references.map((r) => [r.doc_type, r]));
    // design + user-guide + policy admitted; "sprint meeting notes" recalled but dropped.
    expect(Object.keys(byType).sort()).toEqual(["design", "policy", "user-guide"]);
    expect(result.references).toHaveLength(3);
    // Every discovered link is honestly reference-only (body never obtained).
    for (const reference of result.references) {
      expect(reference.content_mode).toBe("reference_only");
      expect(reference.agent_accessible).toBe(false);
      expect(reference.url.startsWith(DEV_CONFLUENCE_BASE_URL)).toBe(true);
    }
  });

  it("discovers per-service references for s3 and aks", async () => {
    const s3Result = await liveDiscovery().discover(s3);
    expect(s3Result.references.map((r) => r.doc_type).sort()).toEqual(["design", "policy"]);

    const aksResult = await liveDiscovery().discover(aks);
    expect(aksResult.references.map((r) => r.doc_type)).toEqual(["user-guide"]);
  });

  it("reports incomplete when recall is truncated (honest partial result)", async () => {
    server.use(
      http.get(searchUrl, () =>
        HttpResponse.json({
          results: [{ title: "Textract — service design", _links: { webui: "/wiki/x" } }],
          totalSize: 99,
          _links: { next: "/wiki/rest/api/content/search?next" },
        }),
      ),
    );
    const result = await liveDiscovery().discover(textract);
    expect(result.incomplete).toBe(true);
    expect(result.references.length).toBeGreaterThan(0);
  });

  it("degrades to unavailable on 401/403 (restricted) and 404 (missing)", async () => {
    for (const status of [401, 403, 404] as const) {
      server.use(http.get(searchUrl, () => new HttpResponse(null, { status })));
      const result = await liveDiscovery().discover(textract);
      expect(result.status).toBe("unavailable");
      expect(result.references).toEqual([]);
    }
  });
});
