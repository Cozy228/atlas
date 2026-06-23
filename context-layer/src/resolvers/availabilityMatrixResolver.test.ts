import { describe, expect, it } from "vitest";
import type { Anchor, Source } from "@atlas/schema";
import { createInMemorySourceContentProvider } from "./sourceContentProvider.js";
import { offlineResolutionContext } from "./resolverTypes.js";
import { availabilityMatrixResolver } from "./availabilityMatrixResolver.js";

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

const cellAnchor: Anchor = {
  id: "availability-s3-us-east-1",
  source_id: "availability-matrix",
  anchor_strategy: "availability-cell",
  title: "S3 availability in us-east-1",
  selector: { service: "S3", region: "us-east-1" },
  citation_label: "Availability Matrix → S3 × us-east-1",
  status: "valid",
  last_validated_at: "2026-05-05T00:00:00.000Z",
};

const rowAnchor: Anchor = {
  ...cellAnchor,
  id: "availability-s3-row",
  selector: { service: "S3" },
  citation_label: "Availability Matrix → S3 row",
};

const columnAnchor: Anchor = {
  ...cellAnchor,
  id: "availability-us-east-1-column",
  selector: { region: "us-east-1" },
  citation_label: "Availability Matrix → us-east-1 column",
};

const anchors = [cellAnchor, rowAnchor, columnAnchor];

const TABLE =
  "| Service | us-east-1 | ca-central-1 |\n" +
  "| --- | --- | --- |\n" +
  "| S3 | available | available |\n" +
  "| API Gateway | available | planned |\n" +
  "| Textract | available | available |";

function resolve(anchorId: string, table: string | undefined) {
  return availabilityMatrixResolver.resolve({
    ctx: offlineResolutionContext(),
    source,
    anchors,
    anchorId,
    contentProvider: createInMemorySourceContentProvider(
      table === undefined ? {} : { "availability-matrix": { "availability-matrix": table } },
    ),
  });
}

describe("availabilityMatrixResolver", () => {
  it("answers a cell query (service + region) with a precise cell citation", async () => {
    const result = await resolve("availability-s3-us-east-1", TABLE);

    expect(result.warnings).toEqual([]);
    expect(result.excerpts[0]?.text).toBe("S3 is available in us-east-1.");
    expect(result.excerpts[0]?.citation).toEqual({
      source_id: "availability-matrix",
      anchor_id: "availability-s3-us-east-1",
      label: "Availability Matrix → S3 × us-east-1",
      location: "https://confluence.example.com/display/CLOUD/Regional+Availability+Matrix",
    });
  });

  it("answers a row query (service only) across every region", async () => {
    const result = await resolve("availability-s3-row", TABLE);

    expect(result.warnings).toEqual([]);
    expect(result.excerpts[0]?.text).toBe("S3 — us-east-1: available; ca-central-1: available.");
    expect(result.excerpts[0]?.citation.label).toBe("Availability Matrix → S3 row");
  });

  it("answers a column query (region only) across every service", async () => {
    const result = await resolve("availability-us-east-1-column", TABLE);

    expect(result.warnings).toEqual([]);
    expect(result.excerpts[0]?.text).toBe(
      "us-east-1 — S3: available; API Gateway: available; Textract: available.",
    );
    expect(result.excerpts[0]?.citation.label).toBe("Availability Matrix → us-east-1 column");
  });

  it("returns an honest dead-end (no data + warning) when the table cannot be parsed", async () => {
    const result = await resolve("availability-s3-us-east-1", "not a table at all");

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]).toMatchObject({
      code: "availability_unavailable",
      source_id: "availability-matrix",
      anchor_id: "availability-s3-us-east-1",
    });
  });

  it("returns an honest dead-end when the source content is unavailable", async () => {
    const result = await resolve("availability-s3-us-east-1", undefined);

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("availability_unavailable");
  });

  it("reports not-planned for a service present in the matrix but absent in a region", async () => {
    const sparse =
      "| Service | us-east-1 | eu-west-1 |\n| --- | --- | --- |\n| S3 | available |  |";
    const result = await resolve("availability-s3-row", sparse);

    expect(result.excerpts[0]?.text).toBe("S3 — us-east-1: available; eu-west-1: not-planned.");
  });

  it("flags a broken anchor when the pinned service is not in the matrix", async () => {
    const result = await resolve(
      "availability-s3-us-east-1",
      "| Service | us-east-1 |\n| --- | --- |\n| Textract | available |",
    );

    expect(result.excerpts).toEqual([]);
    expect(result.warnings[0]?.code).toBe("broken_anchor");
  });
});
