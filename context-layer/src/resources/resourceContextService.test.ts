import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ResourceContextRecord } from "@atlas/schema";
import { createDefaultContextService } from "../composition";
import type { ContextService } from "../services/contextService";
import { createConfluenceReferenceDiscovery } from "../sourceContent/confluenceReferenceDiscovery";
import type { FetchLike } from "../resolvers/resolverTypes";
import { InMemorySourceRepository } from "../repositories/sourceRepository";
import {
  DEV_CONFLUENCE_BASE_URL,
  DEV_CONFLUENCE_SPACE_KEYS,
  setDevDiscoveryEnv,
} from "../devMocks";
import { resourceKindRegistry } from "./resourceKindRegistry";
import {
  getResourceContext,
  InvalidResourceRequestError,
  searchResources,
} from "./resourceContextService";

// Pin `now` so freshness is deterministic regardless of the wall clock: the
// derived sources are within review at this instant.
const NOW = new Date("2026-06-26T00:00:00.000Z");

// Post-flip (plan 018 G5) the registry + resource records are the OUTPUT of live
// discovery, so a fresh service must build them via the discovery channels. Point
// every channel at the MSW fixtures (the global devMocks/setup.ts keeps the
// Node-mode server listening) and `await` the now-async composition.
async function pilotService(overrides: Partial<ContextService> = {}): Promise<ContextService> {
  return { ...(await createDefaultContextService()), now: NOW, ...overrides };
}

/**
 * Add a deliberately-unresolvable Source to a service's registry: a confluence
 * page whose id the fixtures 404, so the live resolver surfaces source_unavailable
 * — the honesty axis under test (never stale data). Mirrors the old YAML seed's
 * `platform-reference-guide` (a registered-but-empty source), now that the derived
 * registry only carries module / availability / policy sources.
 */
function withUnresolvableSource(base: ContextService): ContextService {
  const sources = new InMemorySourceRepository([
    ...base.registry.sources.list(),
    {
      id: "platform-reference-guide",
      title: "Platform Reference Guide",
      source_class: "confluence-page",
      location: "999999", // not in the fixtures → 404 → source_unavailable
      visibility: "internal",
      last_observed_at: "2026-05-05T00:00:00.000Z",
      last_reviewed_at: "2026-05-01T00:00:00.000Z",
      review_frequency: "P90D",
    },
  ]);
  return { ...base, registry: { ...base.registry, sources } };
}

// Live reference-discovery against the MSW source-space fixture (plan 018): the
// real CQL adapter, injected directly so a test can assert reference merge.
const liveFetch: FetchLike = (input, init) =>
  globalThis.fetch(input, init as RequestInit) as unknown as ReturnType<FetchLike>;
function liveReferenceDiscovery() {
  return createConfluenceReferenceDiscovery(
    {
      baseUrl: DEV_CONFLUENCE_BASE_URL,
      token: "dev-mock-token",
      spaceKeys: DEV_CONFLUENCE_SPACE_KEYS,
    },
    { fetch: liveFetch },
  );
}

const savedEnv = { ...process.env };
beforeAll(() => {
  setDevDiscoveryEnv();
});
afterAll(() => {
  process.env = savedEnv;
});

describe("searchResources", () => {
  it("resolves a free-text name to the canonical resource id + urls", async () => {
    // The derived record's canonical name is the spine identity name ("Amazon
    // Textract"); searching it is an exact name match.
    const result = searchResources(await pilotService(), "Amazon Textract");
    const top = result.items[0];

    expect(top?.id).toBe("service/aws/textract");
    expect(top?.kind).toBe("service");
    expect(top?.slug).toBe("aws/textract");
    expect(top?.provider).toBe("aws");
    expect(top?.matchReason).toBe("Exact name or alias match");
    expect(top?.resourceUrl).toBe("/api/resources/service/aws/textract");
    expect(top?.markdownUrl).toBe("/resources/service/aws/textract.md");
  });

  it("absolutizes urls against a base url and matches on a bare alias", async () => {
    const result = searchResources(await pilotService(), "textract", {
      baseUrl: "https://atlas.example.com",
    });
    expect(result.items[0]?.resourceUrl).toBe(
      "https://atlas.example.com/api/resources/service/aws/textract",
    );
  });

  it("returns no items when nothing matches", async () => {
    expect(searchResources(await pilotService(), "nonexistent zzz").items).toEqual([]);
  });
});

describe("getResourceContext — pre-flight gate (service/aws/textract)", () => {
  it("returns network + availability both available, each with a citation", async () => {
    const response = await getResourceContext(await pilotService(), {
      kind: "service",
      slug: "aws/textract",
      sections: ["network", "availability"],
    });

    expect(response).not.toBeNull();
    expect(response?.requestedSections).toEqual(["network", "availability"]);

    const network = response?.sections.network;
    expect(network?.status).toBe("available");
    expect(network?.content?.toLowerCase()).toContain("private subnet");
    expect(network?.citations.length).toBeGreaterThan(0);
    expect(network?.citations[0]?.sourceId).toBe("textract-module-readme");

    const availability = response?.sections.availability;
    expect(availability?.status).toBe("available");
    expect(availability?.content).toContain("us-east-1");
    expect(availability?.content).toContain("ca-central-1");
    expect(availability?.citations[0]?.sourceId).toBe("availability-matrix");
    expect(availability?.citations[0]?.url).toContain("AWS+Foundation+Availability");

    expect(response?.missingSections).toEqual([]);
    expect(response?.resolvedAt).toBe(NOW.toISOString());
  });

  it("stamps each citation with the excerpt provenance time, not the request time", async () => {
    const response = await getResourceContext(await pilotService(), {
      kind: "service",
      slug: "aws/textract",
      sections: ["availability"],
    });
    // Offline provenance = the derived Source's recorded observation time (the
    // fixed in-window stamp), never `now`.
    expect(response?.sections.availability?.citations[0]?.resolvedAt).toBe(
      "2026-06-20T09:00:00.000Z",
    );
    expect(response?.sections.availability?.citations[0]?.resolvedAt).not.toBe(NOW.toISOString());
  });

  it("defaults to every registered section for the kind when none is requested", async () => {
    const response = await getResourceContext(await pilotService(), {
      kind: "service",
      slug: "aws/textract",
    });
    const serviceSections = resourceKindRegistry.service.sections.map((s) => s.id);
    expect(response?.requestedSections).toEqual(serviceSections);
    // Bound sections resolve; unbound ones (pricing, security, …) are reported missing.
    expect(response?.sections.network?.status).toBe("available");
    expect(response?.missingSections.some((m) => m.section === "pricing")).toBe(true);
  });
});

describe("getResourceContext — honesty axes", () => {
  it("reports a requested but unregistered section as missing (no_registered_source)", async () => {
    const response = await getResourceContext(await pilotService(), {
      kind: "service",
      slug: "aws/textract",
      sections: ["pricing"],
    });
    expect(response?.sections.pricing).toBeUndefined();
    expect(response?.missingSections).toEqual([
      {
        section: "pricing",
        code: "no_registered_source",
        message: expect.stringContaining("no registered pricing source"),
      },
    ]);
  });

  it("returns unresolved + warning + null content (never stale data) when the source fails", async () => {
    // platform-reference-guide 404s → source_unavailable.
    const resources: ResourceContextRecord[] = [
      {
        kind: "service",
        slug: "aws/textract",
        provider: "aws",
        name: "Amazon Textract",
        aliases: ["Textract"],
        sections: {
          network: [
            { source_id: "platform-reference-guide", heading: "Pilot limitations", order: 10 },
          ],
        },
      },
    ];
    const response = await getResourceContext(
      withUnresolvableSource(await pilotService({ resources })),
      { kind: "service", slug: "aws/textract", sections: ["network"] },
    );

    const network = response?.sections.network;
    expect(network?.status).toBe("unresolved");
    expect(network?.content).toBeNull();
    expect(network?.citations).toEqual([]);
    expect(network?.warnings.some((w) => w.code === "source_unavailable")).toBe(true);
  });

  it("returns partial when one of two bindings resolves and the other fails", async () => {
    const resources: ResourceContextRecord[] = [
      {
        kind: "service",
        slug: "aws/textract",
        provider: "aws",
        name: "Amazon Textract",
        aliases: ["Textract"],
        sections: {
          network: [
            { source_id: "textract-module-readme", heading: "Private subnet usage", order: 10 },
            { source_id: "platform-reference-guide", heading: "Pilot limitations", order: 20 },
          ],
        },
      },
    ];
    const response = await getResourceContext(
      withUnresolvableSource(await pilotService({ resources })),
      { kind: "service", slug: "aws/textract", sections: ["network"] },
    );
    expect(response?.sections.network?.status).toBe("partial");
    expect(response?.sections.network?.content?.toLowerCase()).toContain("private subnet");
  });

  it("rejects an unknown section with InvalidResourceRequestError", async () => {
    await expect(
      getResourceContext(await pilotService(), {
        kind: "service",
        slug: "aws/textract",
        sections: ["totally-made-up"],
      }),
    ).rejects.toBeInstanceOf(InvalidResourceRequestError);
  });

  it("returns null for an unregistered resource (HTTP maps to 404)", async () => {
    const response = await getResourceContext(await pilotService(), {
      kind: "service",
      slug: "aws/nonexistent",
    });
    expect(response).toBeNull();
  });
});

describe("getResourceContext — name normalization (single-candidate fallback)", () => {
  it.each(["textract", "Textract", "aws-textract", "AWS Textract", "Amazon Textract"])(
    "resolves the non-canonical slug %j to the canonical resource",
    async (slug) => {
      const response = await getResourceContext(await pilotService(), {
        kind: "service",
        slug,
        sections: ["network"],
      });
      // The response always carries the canonical id, never the requested spelling.
      expect(response?.resource.id).toBe("service/aws/textract");
      expect(response?.resource.slug).toBe("aws/textract");
      expect(response?.sections.network?.status).toBe("available");
    },
  );

  it("still returns null for a name that matches no record", async () => {
    expect(
      await getResourceContext(await pilotService(), { kind: "service", slug: "nonexistent" }),
    ).toBeNull();
  });

  it("returns null (never a wrong guess) when a name is ambiguous across records", async () => {
    const resources: ResourceContextRecord[] = [
      {
        kind: "service",
        slug: "aws/alpha",
        provider: "aws",
        name: "Alpha",
        aliases: ["Shared Service"],
        sections: {
          network: [
            { source_id: "textract-module-readme", heading: "Private subnet usage", order: 10 },
          ],
        },
      },
      {
        kind: "service",
        slug: "aws/beta",
        provider: "aws",
        name: "Beta",
        aliases: ["Shared Service"],
        sections: {
          network: [
            { source_id: "textract-module-readme", heading: "Private subnet usage", order: 10 },
          ],
        },
      },
    ];
    expect(
      await getResourceContext(await pilotService({ resources }), {
        kind: "service",
        slug: "shared service",
      }),
    ).toBeNull();
  });
});

describe("getResourceContext — identity-first spine (plan 017 B4/B6)", () => {
  it("renders a spine-only service (in the grid, not yet derived) with empty sections, not 404", async () => {
    // With `resources: []` no service has a derived record, so aws/cloudwatch is
    // spine-only (in the awsf grid) — the identity-first path still renders it.
    const response = await getResourceContext(
      await pilotService({ resources: [], referenceDiscovery: liveReferenceDiscovery() }),
      { kind: "service", slug: "aws/cloudwatch" },
    );

    expect(response).not.toBeNull();
    expect(response?.resource.id).toBe("service/aws/cloudwatch");
    expect(response?.resource.slug).toBe("aws/cloudwatch");
    expect(response?.resource.provider).toBe("aws");
    // Spine-only: empty Sections, NO faked per-section missing entries (B4).
    expect(response?.sections).toEqual({});
    expect(response?.missingSections).toEqual([]);
    expect(response?.requestedSections).toEqual([]);
  });

  it("resolves a discovered service's requested sections", async () => {
    const response = await getResourceContext(await pilotService(), {
      kind: "service",
      slug: "aws/textract",
      sections: ["network"],
    });
    expect(response?.sections.network?.status).toBe("available");
  });

  it("renders a non-service kind from its derived record (no spine)", async () => {
    const response = await getResourceContext(await pilotService(), {
      kind: "guardrail",
      slug: "public-access-controls",
    });
    expect(response).not.toBeNull();
    expect(response?.resource.kind).toBe("guardrail");
  });

  it("still 404s a service that is neither in the spine nor overlaid", async () => {
    expect(
      await getResourceContext(await pilotService(), {
        kind: "service",
        slug: "aws/not-a-real-service",
      }),
    ).toBeNull();
  });
});

describe("getResourceContext — reference discovery merge (plan 017 B4)", () => {
  it("merges reference-only links alongside a configured service's governed sections", async () => {
    const response = await getResourceContext(
      await pilotService({ referenceDiscovery: liveReferenceDiscovery() }),
      { kind: "service", slug: "aws/textract", sections: ["network"] },
    );

    // Governed content AND reference-only links coexist, clearly distinguished.
    expect(response?.sections.network?.status).toBe("available");
    expect(response?.references.length).toBeGreaterThan(0);
    expect(response?.referenceDiscovery?.status).toBe("fresh");
    // Every merged reference stays honestly reference-only.
    for (const reference of response?.references ?? []) {
      expect(reference.content_mode).toBe("reference_only");
      expect(reference.agent_accessible).toBe(false);
    }
  });

  it("runs no discovery for a non-service kind: empty references, null discovery state", async () => {
    const response = await getResourceContext(await pilotService(), {
      kind: "guardrail",
      slug: "public-access-controls",
    });
    expect(response?.references).toEqual([]);
    expect(response?.referenceDiscovery).toBeNull();
  });

  it("omits discovery entirely when no port is wired (honest absence)", async () => {
    const response = await getResourceContext(
      await pilotService({ resources: [], referenceDiscovery: undefined }),
      { kind: "service", slug: "aws/cloudwatch" },
    );
    expect(response?.references).toEqual([]);
    expect(response?.referenceDiscovery).toBeNull();
  });
});

describe("getResourceContext — multi-kind (guardrail) extensibility", () => {
  it("projects a non-service kind, surfacing cited enforced + exceptions sections", async () => {
    const response = await getResourceContext(await pilotService(), {
      kind: "guardrail",
      slug: "public-access-controls",
    });

    expect(response?.resource.kind).toBe("guardrail");
    expect(response?.resource.provider).toBeUndefined();

    const enforced = response?.sections["enforced-controls"];
    expect(enforced?.status).toBe("available");
    expect(enforced?.content?.toLowerCase()).toContain("public access");
    expect(enforced?.citations[0]?.sourceId).toBe("public-access-controls-policy-doc");

    // The exceptions section is the discovered "Legacy bucket waivers" heading,
    // cited from the same policy document — both axes resolve from one source.
    const exceptions = response?.sections.exceptions;
    expect(exceptions?.status).toBe("available");
    expect(exceptions?.content?.toLowerCase()).toContain("waiver");
  });
});

describe("resource projection records — wiring integrity", () => {
  it("every binding references a real source, carries a heading or selector, and sits in the kind vocabulary", async () => {
    const service = await pilotService();
    expect(service.resources.length).toBeGreaterThan(0);
    for (const record of service.resources) {
      const vocab = new Set(resourceKindRegistry[record.kind].sections.map((s) => s.id));
      for (const [sectionId, bindings] of Object.entries(record.sections)) {
        expect(vocab.has(sectionId as never)).toBe(true);
        for (const binding of bindings) {
          const source = service.registry.sources.getById(binding.source_id);
          expect(
            source,
            `source ${binding.source_id} for ${record.kind}/${record.slug}`,
          ).toBeDefined();
          // A binding addresses its section by an inline heading (heading-slug
          // scan) or a structured selector — never a pre-stored anchor.
          const located = Boolean(binding.heading) || Boolean(binding.selector);
          expect(
            located,
            `binding on ${binding.source_id} for ${record.kind}/${record.slug} has a heading or selector`,
          ).toBe(true);
        }
      }
    }
  });
});
