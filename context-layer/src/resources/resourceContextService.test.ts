import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ResourceContextRecord } from "@atlas/schema";
import { createDefaultContextService } from "../composition";
import type { ContextService } from "../services/contextService";
import { createConfluenceReferenceDiscovery } from "../sourceContent/confluenceReferenceDiscovery";
import type { FetchLike } from "../resolvers/resolverTypes";
import {
  DEV_CONFLUENCE_BASE_URL,
  DEV_CONFLUENCE_SPACE_KEYS,
  DEV_TERRAFORM_BASE_URL,
} from "../devMocks/fixtures";
import { resourceKindRegistry } from "./resourceKindRegistry";
import {
  getResourceContext,
  InvalidResourceRequestError,
  searchResources,
} from "./resourceContextService";

// Pin `now` so freshness is deterministic regardless of the wall clock: the
// pilot Textract sources are within review at this instant.
const NOW = new Date("2026-06-26T00:00:00.000Z");

function pilotService(overrides: Partial<ContextService> = {}): ContextService {
  return { ...createDefaultContextService(), now: NOW, ...overrides };
}

// Live reference-discovery against the MSW source-space fixture (plan 018): the
// real CQL adapter, not an in-code fixture. Injected directly (not via env) so the
// offline policy/guardrail sections in this file are left untouched.
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

// Single live path (plan 018): textract's terraform-backed sections (network,
// examples) fetch from the registry; the guardrail's policy sections fetch from
// Confluence (G4). Point ATLAS_TERRAFORM_* and ATLAS_CONFLUENCE_* at the MSW
// fixtures so both resolve live; the global devMocks/setup.ts has the Node-mode
// server listening. Availability stays dev. (Space keys stay unset so the default
// reference-discovery port remains absent — tests inject it explicitly.)
const savedEnv = {
  terraformBaseUrl: process.env.ATLAS_TERRAFORM_BASE_URL,
  terraformToken: process.env.ATLAS_TERRAFORM_TOKEN,
  confluenceBaseUrl: process.env.ATLAS_CONFLUENCE_BASE_URL,
  confluenceToken: process.env.ATLAS_CONFLUENCE_TOKEN,
};
beforeAll(() => {
  process.env.ATLAS_TERRAFORM_BASE_URL = DEV_TERRAFORM_BASE_URL;
  process.env.ATLAS_TERRAFORM_TOKEN = "dev-mock-token";
  process.env.ATLAS_CONFLUENCE_BASE_URL = DEV_CONFLUENCE_BASE_URL;
  process.env.ATLAS_CONFLUENCE_TOKEN = "dev-mock-token";
});
afterAll(() => {
  restoreEnv("ATLAS_TERRAFORM_BASE_URL", savedEnv.terraformBaseUrl);
  restoreEnv("ATLAS_TERRAFORM_TOKEN", savedEnv.terraformToken);
  restoreEnv("ATLAS_CONFLUENCE_BASE_URL", savedEnv.confluenceBaseUrl);
  restoreEnv("ATLAS_CONFLUENCE_TOKEN", savedEnv.confluenceToken);
});
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

describe("searchResources", () => {
  it("resolves a free-text name to the canonical resource id + urls", () => {
    const result = searchResources(pilotService(), "AWS Textract");
    const top = result.items[0];

    expect(top?.id).toBe("service/aws/textract");
    expect(top?.kind).toBe("service");
    expect(top?.slug).toBe("aws/textract");
    expect(top?.provider).toBe("aws");
    expect(top?.matchReason).toBe("Exact name or alias match");
    expect(top?.resourceUrl).toBe("/api/resources/service/aws/textract");
    expect(top?.markdownUrl).toBe("/resources/service/aws/textract.md");
  });

  it("absolutizes urls against a base url and matches on a bare alias", () => {
    const result = searchResources(pilotService(), "textract", {
      baseUrl: "https://atlas.example.com",
    });
    expect(result.items[0]?.resourceUrl).toBe(
      "https://atlas.example.com/api/resources/service/aws/textract",
    );
  });

  it("returns no items when nothing matches", () => {
    expect(searchResources(pilotService(), "nonexistent zzz").items).toEqual([]);
  });
});

describe("getResourceContext — pre-flight gate (service/aws/textract)", () => {
  it("returns network + availability both available, each with a citation", async () => {
    const response = await getResourceContext(pilotService(), {
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
    expect(availability?.citations[0]?.url).toContain("Regional+Availability+Matrix");

    expect(response?.missingSections).toEqual([]);
    expect(response?.resolvedAt).toBe(NOW.toISOString());
  });

  it("stamps each citation with the excerpt provenance time, not the request time", async () => {
    const response = await getResourceContext(pilotService(), {
      kind: "service",
      slug: "aws/textract",
      sections: ["availability"],
    });
    // Offline provenance = the Source's recorded observation time, never `now`.
    expect(response?.sections.availability?.citations[0]?.resolvedAt).toBe(
      "2026-05-05T00:00:00.000Z",
    );
    expect(response?.sections.availability?.citations[0]?.resolvedAt).not.toBe(NOW.toISOString());
  });

  it("defaults to every registered section for the kind when none is requested", async () => {
    const response = await getResourceContext(pilotService(), {
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
    const response = await getResourceContext(pilotService(), {
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
    // platform-reference-guide has no offline content → source_unavailable.
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
    const response = await getResourceContext(pilotService({ resources }), {
      kind: "service",
      slug: "aws/textract",
      sections: ["network"],
    });

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
    const response = await getResourceContext(pilotService({ resources }), {
      kind: "service",
      slug: "aws/textract",
      sections: ["network"],
    });
    expect(response?.sections.network?.status).toBe("partial");
    expect(response?.sections.network?.content?.toLowerCase()).toContain("private subnet");
  });

  it("rejects an unknown section with InvalidResourceRequestError", async () => {
    await expect(
      getResourceContext(pilotService(), {
        kind: "service",
        slug: "aws/textract",
        sections: ["totally-made-up"],
      }),
    ).rejects.toBeInstanceOf(InvalidResourceRequestError);
  });

  it("returns null for an unregistered resource (HTTP maps to 404)", async () => {
    const response = await getResourceContext(pilotService(), {
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
      const response = await getResourceContext(pilotService(), {
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
      await getResourceContext(pilotService(), { kind: "service", slug: "nonexistent" }),
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
      await getResourceContext(pilotService({ resources }), {
        kind: "service",
        slug: "shared service",
      }),
    ).toBeNull();
  });
});

describe("getResourceContext — identity-first spine (plan 017 B4/B6)", () => {
  it("renders a spine-only service (in the grid, no overlay) as governance:unconfigured, not 404", async () => {
    // azure/aks is in the availability spine but has no resources.yaml service
    // record (aws/s3 now carries a metadata overlay — plan 020 15a).
    const response = await getResourceContext(
      pilotService({ referenceDiscovery: liveReferenceDiscovery() }),
      {
        kind: "service",
        slug: "azure/aks",
      },
    );

    expect(response).not.toBeNull();
    expect(response?.governance).toBe("unconfigured");
    expect(response?.resource.id).toBe("service/azure/aks");
    expect(response?.resource.slug).toBe("azure/aks");
    expect(response?.resource.provider).toBe("azure");
    // Spine-only: empty Sections, NO faked per-section missing entries (B4).
    expect(response?.sections).toEqual({});
    expect(response?.missingSections).toEqual([]);
    expect(response?.requestedSections).toEqual([]);
    // Reference-only discovery still runs for a spine-only service (B4): the live
    // CQL adapter surfaces the AKS onboarding guide alongside empty governed Sections.
    expect(response?.references.length ?? 0).toBeGreaterThan(0);
    expect(response?.referenceDiscovery?.status).toBe("fresh");
  });

  it("marks an overlay-backed service as governance:configured", async () => {
    const response = await getResourceContext(pilotService(), {
      kind: "service",
      slug: "aws/textract",
      sections: ["network"],
    });
    expect(response?.governance).toBe("configured");
    expect(response?.sections.network?.status).toBe("available");
  });

  it("marks a non-service overlay kind as governance:configured (no spine)", async () => {
    const response = await getResourceContext(pilotService(), {
      kind: "guardrail",
      slug: "s3-public-access",
    });
    expect(response?.governance).toBe("configured");
  });

  it("still 404s a service that is neither in the spine nor overlaid", async () => {
    expect(
      await getResourceContext(pilotService(), { kind: "service", slug: "aws/not-a-real-service" }),
    ).toBeNull();
  });
});

describe("getResourceContext — reference discovery merge (plan 017 B4)", () => {
  it("merges reference-only links alongside a configured service's governed sections", async () => {
    const response = await getResourceContext(
      pilotService({ referenceDiscovery: liveReferenceDiscovery() }),
      {
        kind: "service",
        slug: "aws/textract",
        sections: ["network"],
      },
    );

    // Governed content AND reference-only links coexist, clearly distinguished.
    expect(response?.governance).toBe("configured");
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
    const response = await getResourceContext(pilotService(), {
      kind: "guardrail",
      slug: "s3-public-access",
    });
    expect(response?.references).toEqual([]);
    expect(response?.referenceDiscovery).toBeNull();
  });

  it("omits discovery entirely when no port is wired (honest absence)", async () => {
    const response = await getResourceContext(pilotService({ referenceDiscovery: undefined }), {
      kind: "service",
      slug: "azure/aks",
    });
    expect(response?.governance).toBe("unconfigured");
    expect(response?.references).toEqual([]);
    expect(response?.referenceDiscovery).toBeNull();
  });
});

describe("getResourceContext — multi-kind (guardrail) extensibility", () => {
  it("projects a non-service kind, surfacing a stale_source warning on live content", async () => {
    const response = await getResourceContext(pilotService(), {
      kind: "guardrail",
      slug: "s3-public-access",
    });

    expect(response?.resource.kind).toBe("guardrail");
    expect(response?.resource.provider).toBeUndefined();

    const enforced = response?.sections["enforced-controls"];
    expect(enforced?.status).toBe("available");
    expect(enforced?.content?.toLowerCase()).toContain("public access");

    // The deprecated exceptions source is past review → available content that
    // honestly carries a stale_source warning (axis 1 + axis 2 are independent).
    const exceptions = response?.sections.exceptions;
    expect(exceptions?.status).toBe("available");
    expect(exceptions?.warnings.some((w) => w.code === "stale_source")).toBe(true);
  });
});

describe("resource projection records — wiring integrity", () => {
  it("every binding references a real source, carries a heading or selector, and sits in the kind vocabulary", () => {
    const service = pilotService();
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
