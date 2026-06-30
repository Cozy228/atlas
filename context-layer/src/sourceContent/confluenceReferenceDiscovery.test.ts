import { describe, expect, it, vi } from "vitest";
import type { ServiceIdentity } from "@atlas/schema";
import type { FetchLike } from "../resolvers/resolverTypes";
import {
  createConfluenceReferenceDiscovery,
  type ConfluenceReferenceDiscoveryConfig,
  type DiscoveryDiagnostic,
} from "./confluenceReferenceDiscovery";

const CONFIG: ConfluenceReferenceDiscoveryConfig = {
  token: "fake-token",
  baseUrl: "https://wiki.example.com",
  email: "bot@example.com",
  spaceKeys: ["CLOUD"],
};

const textract: ServiceIdentity = {
  provider: "aws",
  id: "textract",
  name: "Amazon Textract",
  key: "aws/textract",
  recallAliases: ["amazon textract", "textract"],
  admissionAliases: ["amazon textract", "textract"],
};

type CqlBody = {
  results?: Array<Record<string, unknown>>;
  totalSize?: number;
  _links?: { next?: string };
};

function page(title: string, webui: string): Record<string, unknown> {
  return { title, _links: { webui } };
}

/** A FetchLike that replays a queue of responses (last one repeats), recording URLs. */
function fakeFetch(responses: Array<CqlBody | "fail">): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  let index = 0;
  const fetch: FetchLike = async (url) => {
    calls.push(url);
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    if (response === "fail") {
      return { ok: false, status: 500, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => response };
  };
  return { fetch, calls };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createConfluenceReferenceDiscovery — CQL recall + double-hit admission", () => {
  it("builds a CQL recall from the identity aliases scoped to the configured spaces", async () => {
    const { fetch, calls } = fakeFetch([{ results: [], totalSize: 0 }]);
    const discovery = createConfluenceReferenceDiscovery(CONFIG, { fetch });

    await discovery.discover(textract);

    expect(calls[0]).toContain("/wiki/rest/api/content/search?cql=");
    const cql = decodeURIComponent(calls[0].split("cql=")[1].split("&")[0]);
    expect(cql).toBe(
      '(title ~ "amazon textract" OR title ~ "textract") AND space in ("CLOUD") AND type = page',
    );
    expect(calls[0]).toContain("limit=50");
  });

  it("admits ONLY candidates that hit identity AND a doc-type, categorizing by doc_type", async () => {
    const onDiagnostic = vi.fn<(d: DiscoveryDiagnostic) => void>();
    const { fetch } = fakeFetch([
      {
        results: [
          page("Textract — Service Design", "/wiki/spaces/CLOUD/pages/1/Design"),
          page("Textract Onboarding Guide", "/wiki/spaces/CLOUD/pages/2/Guide"),
          page("Textract Data Policy", "/wiki/spaces/CLOUD/pages/3/Policy"),
          page("Unrelated Meeting Notes", "/wiki/spaces/CLOUD/pages/4/Notes"), // no identity hit
          page("Textract Retrospective", "/wiki/spaces/CLOUD/pages/5/Retro"), // identity but no doc-type
        ],
        totalSize: 5,
      },
    ]);
    const discovery = createConfluenceReferenceDiscovery(CONFIG, { fetch, onDiagnostic });

    const result = await discovery.discover(textract);

    expect(result.references).toHaveLength(3);
    expect(new Set(result.references.map((r) => r.doc_type))).toEqual(
      new Set(["design", "user-guide", "policy"]),
    );
    expect(result.references[0].url).toBe(
      "https://wiki.example.com/wiki/spaces/CLOUD/pages/1/Design",
    );
    for (const reference of result.references) {
      expect(reference.content_mode).toBe("reference_only");
      expect(reference.agent_accessible).toBe(false);
    }
    expect(result.status).toBe("fresh");
    expect(result.incomplete).toBe(false);
    // Misses go to structured diagnostics, never an `other` bucket.
    expect(onDiagnostic).toHaveBeenCalledWith({
      key: "aws/textract",
      recalled: 5,
      admitted: 3,
      rejected: 2,
      truncated: false,
    });
  });

  it("does NOT admit a title matching only the bare machine slug (DoD #5 identity precision)", async () => {
    // recall is wide (the bare slug "dms" is recall-eligible), admission is narrow.
    const dms: ServiceIdentity = {
      provider: "aws",
      id: "dms",
      name: "Database Migration Service",
      key: "aws/dms",
      recallAliases: ["database migration service", "dms"],
      admissionAliases: ["database migration service"],
    };
    const { fetch } = fakeFetch([
      {
        results: [
          page("DMS Rollout Plan", "/wiki/spaces/CLOUD/pages/9/DMS"), // slug-only → rejected
          page("Database Migration Service — User Guide", "/wiki/spaces/CLOUD/pages/10/Guide"),
        ],
        totalSize: 2,
      },
    ]);
    const discovery = createConfluenceReferenceDiscovery(CONFIG, { fetch });

    const result = await discovery.discover(dms);

    expect(result.references).toHaveLength(1);
    expect(result.references[0].title).toBe("Database Migration Service — User Guide");
    expect(result.references[0].doc_type).toBe("user-guide");
  });

  it("resolves the most-specific doc-type and tie-breaks policy > design", async () => {
    const { fetch } = fakeFetch([
      { results: [page("Textract Security Policy Design", "/wiki/x/1")], totalSize: 1 },
    ]);
    const discovery = createConfluenceReferenceDiscovery(CONFIG, { fetch });

    const result = await discovery.discover(textract);
    // "security policy" (len 2, policy) beats "design" (len 1).
    expect(result.references[0].doc_type).toBe("policy");
  });
});

describe("createConfluenceReferenceDiscovery — cache honesty (B12, DoD #6)", () => {
  it("serves from cache within the fresh TTL without re-fetching", async () => {
    let clock = 0;
    const { fetch, calls } = fakeFetch([
      { results: [page("Textract Design", "/wiki/x/1")], totalSize: 1 },
    ]);
    const discovery = createConfluenceReferenceDiscovery(CONFIG, { fetch, now: () => clock });

    const first = await discovery.discover(textract);
    clock += 30 * 60 * 1000; // 30 min < 1h TTL
    const second = await discovery.discover(textract);

    expect(first.status).toBe("fresh");
    expect(second.status).toBe("fresh");
    expect(calls).toHaveLength(1); // no re-fetch within the window
  });

  it("serves stale + refreshes in the 1h–24h window", async () => {
    let clock = 0;
    const { fetch, calls } = fakeFetch([
      { results: [page("Textract Design", "/wiki/x/1")], totalSize: 1 },
      { results: [page("Textract Onboarding Guide", "/wiki/x/2")], totalSize: 1 },
    ]);
    const discovery = createConfluenceReferenceDiscovery(CONFIG, { fetch, now: () => clock });

    await discovery.discover(textract); // prime at t0
    clock += 2 * 60 * 60 * 1000; // 2h: past TTL, within max-staleness
    const stale = await discovery.discover(textract);

    expect(stale.status).toBe("stale");
    expect(stale.references[0].doc_type).toBe("design"); // last-good served immediately
    await flush(); // let the single-flight background refresh settle
    expect(calls).toHaveLength(2);
  });

  it("reports unavailable past max-staleness when the refresh fails (never unbounded stale)", async () => {
    let clock = 0;
    const { fetch } = fakeFetch([
      { results: [page("Textract Design", "/wiki/x/1")], totalSize: 1 },
      "fail",
    ]);
    const discovery = createConfluenceReferenceDiscovery(CONFIG, { fetch, now: () => clock });

    await discovery.discover(textract); // prime at t0
    clock += 25 * 60 * 60 * 1000; // 25h: past max-staleness
    const result = await discovery.discover(textract);

    expect(result.status).toBe("unavailable");
    expect(result.references).toEqual([]); // refuse to serve >24h links
    expect(result.last_observed_at).toBe(new Date(0).toISOString()); // honest last-good time
  });

  it("flags a truncated recall as incomplete and logs it", async () => {
    const onDiagnostic = vi.fn<(d: DiscoveryDiagnostic) => void>();
    const { fetch } = fakeFetch([
      {
        results: [page("Textract Design", "/wiki/x/1")],
        totalSize: 1,
        _links: { next: "/wiki/rest/api/content/search?cql=...&start=50" },
      },
    ]);
    const discovery = createConfluenceReferenceDiscovery(CONFIG, { fetch, onDiagnostic });

    const result = await discovery.discover(textract);

    expect(result.incomplete).toBe(true);
    expect(onDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ key: "aws/textract", truncated: true }),
    );
  });

  it("is an honest gap on a cold-start fetch failure (no fabricated links)", async () => {
    const { fetch } = fakeFetch(["fail"]);
    const discovery = createConfluenceReferenceDiscovery(CONFIG, { fetch });

    const result = await discovery.discover(textract);

    expect(result.status).toBe("unavailable");
    expect(result.references).toEqual([]);
    expect(result.last_observed_at).toBeNull();
  });

  it("single-flights concurrent discovery for one key", async () => {
    const { fetch, calls } = fakeFetch([
      { results: [page("Textract Design", "/wiki/x/1")], totalSize: 1 },
    ]);
    const discovery = createConfluenceReferenceDiscovery(CONFIG, { fetch });

    const [a, b] = await Promise.all([discovery.discover(textract), discovery.discover(textract)]);

    expect(a.references).toHaveLength(1);
    expect(b.references).toHaveLength(1);
    expect(calls).toHaveLength(1); // both callers shared one fetch
  });
});
