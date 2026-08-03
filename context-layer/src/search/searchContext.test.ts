import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createDefaultContextService } from "../composition";
import { setDevDiscoveryEnv } from "../devMocks";
import { searchContext } from "./searchContext";

const savedEnv = { ...process.env };

beforeAll(() => {
  setDevDiscoveryEnv();
});

afterAll(() => {
  process.env = savedEnv;
});

describe("searchContext", () => {
  it("returns keyword-relevant governed excerpts with their citations", async () => {
    const result = await searchContext(await createDefaultContextService(), {
      query: "private subnet usage",
      limit: 3,
    });

    const match = result.matches.find(
      (candidate) => candidate.resource.id === "service/aws/textract",
    );
    expect(match?.matched_terms).toEqual(expect.arrayContaining(["private", "subnet", "usage"]));
    expect(match?.excerpts.length).toBeLessThanOrEqual(3);
    expect(match?.excerpts.every((excerpt) => excerpt.citations.length > 0)).toBe(true);

    const network = match?.excerpts.find((excerpt) => excerpt.section === "network");
    expect(network?.text.toLowerCase()).toContain("private subnet");
    expect(network?.citations[0]?.sourceId).toBe("textract-module-readme");
  });

  it("discovers a resource through its governed description", async () => {
    const result = await searchContext(await createDefaultContextService(), {
      query: "document OCR",
      limit: 3,
    });

    expect(result.matches[0]?.resource.id).toBe("service/aws/textract");
    expect(result.matches[0]?.matched_terms).toEqual(expect.arrayContaining(["document", "ocr"]));
  });
});
