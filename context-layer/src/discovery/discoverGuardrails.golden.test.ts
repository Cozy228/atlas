/**
 * Golden guardrail discovery test (plan 018 G5). Boots the shared Node-mode MSW
 * server (via the global `devMocks/setup.ts` setupFiles) so the live Confluence
 * crawl path runs unchanged against the fictional SECPOL space fixtures, then runs
 * `discoverGuardrails` → `deriveGuardrailResources` / `deriveGuardrailSourceRecords`
 * and asserts the discovered headings + derived sections/sources. A separate unit
 * block drives `deriveGuardrailResources` over synthetic input to prove
 * evidence-based binding (a page missing the exceptions heading omits that section).
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  ResourceContextRecordSchema,
  type ResourceContextRecord,
  type Source,
} from "@atlas/schema";
import { DEV_CONFLUENCE_BASE_URL, DEV_CONFLUENCE_SECURITY_SPACE_KEY } from "../devMocks";
import { defaultResolutionContext } from "../resolvers/resolverTypes";
import {
  discoverGuardrails,
  type DiscoveredGuardrail,
  type DiscoverGuardrailsDeps,
} from "./discoverGuardrails";
import { deriveGuardrailResources, deriveGuardrailSourceRecords } from "./deriveGuardrails";

describe("guardrail discovery → derivation (golden)", () => {
  let discovered: DiscoveredGuardrail[];
  let records: ResourceContextRecord[];
  let recordsBySlug: Map<string, ResourceContextRecord>;
  let sources: Source[];

  beforeAll(async () => {
    process.env.ATLAS_CONFLUENCE_BASE_URL = DEV_CONFLUENCE_BASE_URL;
    process.env.ATLAS_CONFLUENCE_TOKEN = "dev-mock-token";

    const ctx = defaultResolutionContext(); // late-bound fetch → MSW interceptor
    const deps: DiscoverGuardrailsDeps = {
      ctx,
      confluence: {
        baseUrl: DEV_CONFLUENCE_BASE_URL,
        token: "dev-mock-token",
        spaceKey: DEV_CONFLUENCE_SECURITY_SPACE_KEY,
      },
    };

    discovered = await discoverGuardrails(deps);
    records = deriveGuardrailResources(discovered);
    recordsBySlug = new Map(records.map((record) => [record.slug, record]));
    sources = deriveGuardrailSourceRecords(discovered);
  });

  it("discovers the four SECPOL guardrails with their headings", () => {
    const bySlug = new Map(discovered.map((g) => [g.slug, g]));
    expect([...bySlug.keys()].sort()).toEqual([
      "data-encryption-standard",
      "iam-permission-boundary",
      "private-networking-baseline",
      "public-access-controls",
    ]);

    const encryption = bySlug.get("data-encryption-standard");
    expect(encryption).toMatchObject({ name: "Data Encryption Standard", pageId: "310001" });
    // `<h1>` page title is excluded from the section TOC; only `<h2>`+ are bindable.
    expect(encryption!.headings).toEqual(["Encryption controls", "Legacy exceptions"]);
  });

  it("binds enforced-controls + exceptions by heading match (encryption guardrail)", () => {
    const encryption = recordsBySlug.get("data-encryption-standard");
    expect(encryption).toBeDefined();
    expect(encryption!.kind).toBe("guardrail");
    expect(encryption!.aliases).toEqual(["Data Encryption Standard", "data-encryption-standard"]);
    expect(encryption!.sections["enforced-controls"]).toEqual([
      {
        source_id: "data-encryption-standard-policy-doc",
        heading: "Encryption controls",
        citation_label: "Encryption controls",
        order: 10,
      },
    ]);
    expect(encryption!.sections.exceptions).toEqual([
      {
        source_id: "data-encryption-standard-policy-doc",
        heading: "Legacy exceptions",
        citation_label: "Legacy exceptions",
        order: 10,
      },
    ]);
  });

  it("does not let an enforced-also-matching heading steal the exceptions section", () => {
    // "Public access controls" matches enforced; "Legacy bucket waivers" matches
    // exceptions — each section claims its own heading.
    const publicAccess = recordsBySlug.get("public-access-controls");
    expect(publicAccess!.sections["enforced-controls"]?.[0].heading).toBe("Public access controls");
    expect(publicAccess!.sections.exceptions?.[0].heading).toBe("Legacy bucket waivers");
  });

  it("emits one policy-document Source per guardrail, id == binding source_id", () => {
    expect(sources).toHaveLength(records.length);
    const encryption = sources.find((s) => s.id === "data-encryption-standard-policy-doc");
    expect(encryption).toMatchObject({
      id: "data-encryption-standard-policy-doc",
      title: "Data Encryption Standard",
      source_class: "policy-document",
      location: "310001",
      steward: "cloud-security",
      visibility: "internal",
      authority_scope: ["security-guardrail"],
      authority_level: "authoritative",
      review_frequency: "quarterly",
    });
    // Every binding's source_id resolves to an emitted Source id.
    const sourceIds = new Set(sources.map((s) => s.id));
    for (const record of records) {
      for (const bindings of Object.values(record.sections)) {
        for (const binding of bindings) {
          expect(sourceIds.has(binding.source_id)).toBe(true);
        }
      }
    }
  });

  it("derives schema-valid records, both sections present on every fixture guardrail", () => {
    expect(records.length).toBe(4);
    for (const record of records) {
      expect(record.kind).toBe("guardrail");
      expect(record.sections["enforced-controls"]).toBeDefined();
      expect(record.sections.exceptions).toBeDefined();
      expect(() => ResourceContextRecordSchema.parse(record)).not.toThrow();
    }
  });
});

describe("deriveGuardrailResources (evidence-based binding)", () => {
  it("omits a section with no matching heading (honest gap)", () => {
    const enforcedOnly: DiscoveredGuardrail = {
      slug: "tagging-standard",
      name: "Tagging Standard",
      pageId: "319001",
      headings: ["Mandatory tags"], // enforced match only, no exceptions-matching heading
    };
    const [record] = deriveGuardrailResources([enforcedOnly]);
    expect(record.sections["enforced-controls"]).toEqual([
      {
        source_id: "tagging-standard-policy-doc",
        heading: "Mandatory tags",
        citation_label: "Mandatory tags",
        order: 10,
      },
    ]);
    expect(record.sections.exceptions).toBeUndefined();
    // Honest gap is still a schema-valid record (no empty section object).
    expect(() => ResourceContextRecordSchema.parse(record)).not.toThrow();
  });
});
