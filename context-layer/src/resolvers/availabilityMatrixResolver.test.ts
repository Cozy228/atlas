import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Source } from "@atlas/schema";
import { DEV_AVAILABILITY_PAGE_ID_AWSF, DEV_CONFLUENCE_BASE_URL } from "../devMocks";
import { defaultResolutionContext } from "./resolverTypes";
import { availabilityMatrixResolver } from "./availabilityMatrixResolver";

/**
 * Single live path (plan 021 G3): the resolver fetches + parses the `awsf`
 * availability page through MSW, exactly like every other source, then answers
 * cell / row / column queries. No injected content provider.
 */
const source: Source = {
  id: "availability-matrix",
  title: "Regional Availability Matrix",
  source_class: "availability-matrix",
  location: DEV_AVAILABILITY_PAGE_ID_AWSF,
  visibility: "internal",
  authority_scope: ["regional-availability"],
  authority_level: "authoritative",
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-05-01T00:00:00.000Z",
  review_frequency: "P90D",
};

const saved = {
  baseUrl: process.env.CONFLUENCE_BASE_URL,
  token: process.env.CONFLUENCE_TOKEN,
};
function setEnv(): void {
  process.env.CONFLUENCE_BASE_URL = DEV_CONFLUENCE_BASE_URL;
  process.env.CONFLUENCE_TOKEN = "dev-mock-token";
}
function restore(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
beforeAll(setEnv);
afterAll(() => {
  restore("CONFLUENCE_BASE_URL", saved.baseUrl);
  restore("CONFLUENCE_TOKEN", saved.token);
});

function resolve(selector: Record<string, string>, citationLabel?: string) {
  return availabilityMatrixResolver.resolve({
    ctx: defaultResolutionContext(),
    source,
    selector,
    citationLabel,
  });
}

describe("availabilityMatrixResolver (single live path)", () => {
  it("answers a cell query (service + region) with a citation built from the live page", async () => {
    const result = await resolve(
      { service: "S3", region: "us-east-1" },
      "Availability → S3 × us-east-1",
    );

    expect(result.warnings).toEqual([]);
    expect(result.excerpts[0]?.text).toBe("Amazon S3 is available in us-east-1.");
    expect(result.excerpts[0]?.citation.source_id).toBe("availability-matrix");
    expect(result.excerpts[0]?.citation.label).toBe("Availability → S3 × us-east-1");
    expect(result.excerpts[0]?.citation.location).toContain("AWS+Foundation+Availability");
  });

  it("answers a row query (service only) across every region", async () => {
    const result = await resolve({ service: "Textract" });

    expect(result.warnings).toEqual([]);
    expect(result.excerpts[0]?.text).toBe(
      "Amazon Textract — us-east-1: available; ca-central-1: available.",
    );
  });

  it("answers a column query (region only) across every service", async () => {
    const result = await resolve({ region: "us-east-1" });

    expect(result.warnings).toEqual([]);
    expect(result.excerpts[0]?.text).toContain("Amazon S3: available");
    expect(result.excerpts[0]?.text).toContain("Amazon Textract: available");
  });

  it("reports not-planned for a service present in the grid but absent in a region", async () => {
    const result = await resolve({ service: "ELB", region: "us-east-1" });

    expect(result.excerpts[0]?.text).toBe(
      "Elastic Load Balancing (ELB) is not-planned in us-east-1.",
    );
  });

  it("flags a broken selector when the pinned service is not in the matrix", async () => {
    const result = await resolve({ service: "not-a-service", region: "us-east-1" });

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });

  it("returns an honest dead-end (no data + warning) when no Confluence channel is configured", async () => {
    delete process.env.CONFLUENCE_BASE_URL;
    delete process.env.CONFLUENCE_TOKEN;
    const result = await resolve({ service: "S3", region: "us-east-1" });
    setEnv();

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("availability_unavailable");
  });
});
