import { describe, expect, it } from "vitest";
import type { Source } from "@atlas/schema";
import { createInMemorySourceContentProvider } from "./sourceContentProvider";
import { defaultResolutionContext } from "./resolverTypes";
import { availabilityMatrixResolver } from "./availabilityMatrixResolver";

const source: Source = {
  id: "availability-matrix",
  title: "Regional Availability Matrix",
  source_class: "availability-matrix",
  location: "https://confluence.example.com/display/CLOUD/Regional+Availability+Matrix",
  steward: "cloud-platform",
  visibility: "internal",
  authority_scope: ["regional-availability"],
  authority_level: "authoritative",
  last_observed_at: "2026-05-05T00:00:00.000Z",
  last_reviewed_at: "2026-05-01T00:00:00.000Z",
  review_frequency: "P90D",
};

const TABLE =
  "| Service | us-east-1 | ca-central-1 |\n" +
  "| --- | --- | --- |\n" +
  "| S3 | available | available |\n" +
  "| API Gateway | available | planned |\n" +
  "| Textract | available | available |";

function resolve(
  selector: Record<string, string>,
  table: string | undefined,
  citationLabel?: string,
) {
  return availabilityMatrixResolver.resolve({
    ctx: defaultResolutionContext(),
    source,
    selector,
    citationLabel,
    contentProvider: createInMemorySourceContentProvider(
      table === undefined ? {} : { "availability-matrix": { "availability-matrix": table } },
    ),
  });
}

describe("availabilityMatrixResolver", () => {
  it("answers a cell query (service + region) with a precise cell citation", async () => {
    const result = await resolve(
      { service: "S3", region: "us-east-1" },
      TABLE,
      "Availability Matrix → S3 × us-east-1",
    );

    expect(result.warnings).toEqual([]);
    expect(result.excerpts[0]?.text).toBe("S3 is available in us-east-1.");
    expect(result.excerpts[0]?.citation).toEqual({
      source_id: "availability-matrix",
      label: "Availability Matrix → S3 × us-east-1",
      location: "https://confluence.example.com/display/CLOUD/Regional+Availability+Matrix",
    });
  });

  it("answers a row query (service only) across every region", async () => {
    const result = await resolve({ service: "S3" }, TABLE, "Availability Matrix → S3 row");

    expect(result.warnings).toEqual([]);
    expect(result.excerpts[0]?.text).toBe("S3 — us-east-1: available; ca-central-1: available.");
    expect(result.excerpts[0]?.citation.label).toBe("Availability Matrix → S3 row");
  });

  it("answers a column query (region only) across every service", async () => {
    const result = await resolve(
      { region: "us-east-1" },
      TABLE,
      "Availability Matrix → us-east-1 column",
    );

    expect(result.warnings).toEqual([]);
    expect(result.excerpts[0]?.text).toBe(
      "us-east-1 — S3: available; API Gateway: available; Textract: available.",
    );
    expect(result.excerpts[0]?.citation.label).toBe("Availability Matrix → us-east-1 column");
  });

  it("returns an honest dead-end (no data + warning) when the table cannot be parsed", async () => {
    const result = await resolve({ service: "S3", region: "us-east-1" }, "not a table at all");

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]).toMatchObject({
      code: "availability_unavailable",
      source_id: "availability-matrix",
    });
  });

  it("returns an honest dead-end when the source content is unavailable", async () => {
    const result = await resolve({ service: "S3", region: "us-east-1" }, undefined);

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("availability_unavailable");
  });

  it("reports not-planned for a service present in the matrix but absent in a region", async () => {
    const sparse =
      "| Service | us-east-1 | eu-west-1 |\n| --- | --- | --- |\n| S3 | available |  |";
    const result = await resolve({ service: "S3" }, sparse);

    expect(result.excerpts[0]?.text).toBe("S3 — us-east-1: available; eu-west-1: not-planned.");
  });

  it("flags a broken selector when the pinned service is not in the matrix", async () => {
    const result = await resolve(
      { service: "S3", region: "us-east-1" },
      "| Service | us-east-1 |\n| --- | --- |\n| Textract | available |",
    );

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });
});
