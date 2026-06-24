import { describe, expect, it } from "vitest";
import { parseNewsletter } from "./parseNewsletter.js";

const SAMPLE = `# Platform newsletter — June

## [New] API Gateway adoption gate
2026-06-04
Grounded adoption journey for S3, API Gateway, and Textract.
Each step is cited.

## [Policy] S3 public-access baseline
2026-06-02
Block-public-access is now enforced by guardrail.

## Updated availability matrix
Region coverage refreshed for the quarter.
`;

describe("parseNewsletter", () => {
  it("splits the body into one entry per heading", () => {
    const entries = parseNewsletter(SAMPLE);
    // The title-only top heading has no body lines but still counts as a section;
    // the three item headings carry content.
    expect(entries.map((e) => e.title)).toEqual([
      "Platform newsletter — June",
      "API Gateway adoption gate",
      "S3 public-access baseline",
      "Updated availability matrix",
    ]);
  });

  it("reads the tagged kind, ISO date, and joined summary", () => {
    const [, gate] = parseNewsletter(SAMPLE);
    expect(gate).toEqual({
      kind: "New",
      title: "API Gateway adoption gate",
      date: "2026-06-04",
      summary: "Grounded adoption journey for S3, API Gateway, and Textract. Each step is cited.",
    });
  });

  it("infers the kind from a keyword when untagged, and tolerates a missing date", () => {
    const last = parseNewsletter(SAMPLE).at(-1);
    expect(last).toMatchObject({
      kind: "Updated",
      title: "Updated availability matrix",
      date: "",
      summary: "Region coverage refreshed for the quarter.",
    });
  });

  it("defaults to Updated for an untagged, keyword-free heading", () => {
    const [entry] = parseNewsletter("## Quarterly housekeeping\nMinor edits.");
    expect(entry.kind).toBe("Updated");
  });
});
