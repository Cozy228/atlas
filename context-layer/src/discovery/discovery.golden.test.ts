/**
 * Golden discovery test (plan 018 G5, de-specialized). Boots the shared Node-mode
 * MSW server (via the global `devMocks/setup.ts` setupFiles) so the live Terraform
 * discovery path runs unchanged against the fictional registry fixtures, then runs
 * `discoverServiceSources` → `deriveServiceResources` over the WHOLE availability
 * spine and asserts the derived resources/sections/citations.
 *
 * All services are 平权 (no privileged "textract gate"): the content-level golden
 * set below pins three representative shapes (module with a network heading, module
 * without one, module-less), and a uniform invariant holds over every derived
 * record (generic over N) — every service derives `availability`, and every record
 * validates against `ResourceContextRecordSchema`.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  ResourceContextRecordSchema,
  type ResourceContextRecord,
  type Source,
} from "@atlas/schema";
import {
  DEV_AVAILABILITY_PAGE_ID_AWSF,
  DEV_CONFLUENCE_BASE_URL,
  DEV_TERRAFORM_BASE_URL,
} from "../devMocks";
import { createConfluenceAvailabilityProvider } from "../sourceContent/confluenceAvailabilityProvider";
import { defaultResolutionContext } from "../resolvers/resolverTypes";
import { discoverServiceSources, type DiscoverServiceSourcesDeps } from "./discoverSources";
import { deriveServiceResources, deriveServiceSourceRecords } from "./deriveResources";

describe("service discovery → resource derivation (golden)", () => {
  let records: ResourceContextRecord[];
  let recordsById: Map<string, ResourceContextRecord>;
  let sources: Source[];

  beforeAll(async () => {
    // Point the live Terraform + availability adapters at the MSW-served fixtures.
    process.env.ATLAS_TERRAFORM_BASE_URL = DEV_TERRAFORM_BASE_URL;
    process.env.ATLAS_TERRAFORM_TOKEN = "dev-mock-token";
    process.env.ATLAS_CONFLUENCE_BASE_URL = DEV_CONFLUENCE_BASE_URL;
    process.env.ATLAS_CONFLUENCE_TOKEN = "dev-mock-token";
    process.env.ATLAS_CONFLUENCE_AVAILABILITY_PAGE_AWSF = DEV_AVAILABILITY_PAGE_ID_AWSF;

    const ctx = defaultResolutionContext(); // late-bound fetch → MSW interceptor
    const deps: DiscoverServiceSourcesDeps = {
      availabilityProvider: createConfluenceAvailabilityProvider({ fetch: ctx.fetch }),
      ctx,
      terraform: {
        baseUrl: process.env.ATLAS_TERRAFORM_BASE_URL!,
        token: process.env.ATLAS_TERRAFORM_TOKEN!,
      },
    };

    const discovered = await discoverServiceSources(deps);
    records = deriveServiceResources(discovered);
    recordsById = new Map(records.map((record) => [`${record.kind}/${record.slug}`, record]));
    sources = deriveServiceSourceRecords(discovered);
  });

  it("derives network + examples + availability for a module with a network heading (textract)", () => {
    const textract = recordsById.get("service/aws/textract");
    expect(textract).toBeDefined();
    expect(textract!.provider).toBe("aws");
    expect(textract!.sections.network).toEqual([
      {
        source_id: "textract-module-readme",
        heading: "Private subnet usage",
        citation_label: "Private subnet usage",
        order: 10,
      },
    ]);
    expect(textract!.sections.examples).toEqual([
      {
        source_id: "textract-module-readme",
        heading: "Terraform starter",
        citation_label: "Terraform starter",
        order: 10,
      },
    ]);
    expect(textract!.sections.availability).toEqual([
      {
        source_id: "availability-matrix",
        selector: { service: "Amazon Textract" },
        citation_label: "Amazon Textract regional availability",
        order: 10,
      },
    ]);
  });

  it("derives examples + availability but omits network when the module has no network heading (s3)", () => {
    const s3 = recordsById.get("service/aws/s3");
    expect(s3).toBeDefined();
    expect(s3!.sections.examples).toEqual([
      {
        source_id: "s3-module-readme",
        heading: "Terraform starter",
        citation_label: "Terraform starter",
        order: 10,
      },
    ]);
    expect(s3!.sections.availability).toBeDefined();
    // Honest gap, not an empty section: the key is absent entirely.
    expect(s3!.sections.network).toBeUndefined();
  });

  it("derives only availability for a module-less service (cloudwatch)", () => {
    const cloudwatch = recordsById.get("service/aws/cloudwatch");
    expect(cloudwatch).toBeDefined();
    expect(Object.keys(cloudwatch!.sections)).toEqual(["availability"]);
    expect(cloudwatch!.sections.availability).toEqual([
      {
        source_id: "availability-matrix",
        selector: { service: "CloudWatch" },
        citation_label: "CloudWatch regional availability",
        order: 10,
      },
    ]);
  });

  it("emits a Source per discovered module plus the synthetic availability-matrix source", () => {
    const ids = sources.map((source) => source.id);
    expect(ids).toContain("textract-module-readme");
    expect(ids).toContain("availability-matrix");

    const moduleSource = sources.find((source) => source.id === "textract-module-readme");
    expect(moduleSource?.source_class).toBe("terraform-module");
    expect(moduleSource?.location).toBe("example/textract/aws");

    const availabilitySource = sources.find((source) => source.id === "availability-matrix");
    expect(availabilitySource?.source_class).toBe("availability-matrix");
    expect(availabilitySource?.location).toBe("availability");
  });

  it("derives availability uniformly over N and validates every record against the schema", () => {
    expect(records.length).toBeGreaterThan(1);
    for (const record of records) {
      expect(record.kind).toBe("service");
      // Uniform: every service derives availability from the matrix source.
      expect(record.sections.availability).toEqual([
        {
          source_id: "availability-matrix",
          selector: { service: record.name },
          citation_label: `${record.name} regional availability`,
          order: 10,
        },
      ]);
      // Content-level golden: the derived record is schema-valid (no empty sections).
      expect(() => ResourceContextRecordSchema.parse(record)).not.toThrow();
    }
  });
});
