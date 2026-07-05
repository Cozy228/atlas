import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Brief, BriefDepth } from "@atlas/schema";
import { handleBriefRequest } from "../api/briefsRoute";
import { createResolutionContext } from "../resolvers/createResolutionContext";
import { setDevDiscoveryEnv } from "../devMocks";

/**
 * D7 — `?depth` is an acceptance property, not an option (M9/P28): `citations`
 * returns structure + citations with NO excerpt bodies (the agent face is
 * consumable without paying excerpt cost), `excerpts` adds the bodies. Both faces
 * must carry the SAME block structure — depth only gates the bodies. Driven
 * against the MSW discovery fixtures (public-safe `aws/textract` in `awsf`).
 *
 * Red in Batch 0: `handleBriefRequest` throws `unimplemented`. Green at Batch 5.
 */

const savedEnv = { ...process.env };
beforeAll(() => {
  setDevDiscoveryEnv(process.env, { referenceSpace: false });
});
afterAll(() => {
  process.env = savedEnv;
});

async function adoptBriefAt(depth: BriefDepth): Promise<Brief> {
  const ctx = await createResolutionContext({
    scope: { kind: "by-value", landingZones: ["awsf"] },
  });
  const result = await handleBriefRequest("adopt", ctx, { service: "aws/textract", depth });
  expect(result.status).toBe(200);
  return result.body as Brief;
}

describe("brief depth (D7)", () => {
  it("citations: structure + citations, no excerpt bodies", async () => {
    const brief = await adoptBriefAt("citations");
    const evidence = brief.blocks.flatMap((block) => block.evidence);
    expect(evidence.length).toBeGreaterThan(0);
    for (const item of evidence) {
      expect(item.excerpt).toBeNull();
      expect(item.citations.length).toBeGreaterThan(0);
    }
  });

  it("excerpts: citations plus resolved section bodies", async () => {
    const brief = await adoptBriefAt("excerpts");
    const withBodies = brief.blocks
      .flatMap((block) => block.evidence)
      .filter((item) => item.excerpt !== null);
    expect(withBodies.length).toBeGreaterThan(0);
  });

  it("the agent face is correct at citations: identical block structure, only bodies differ", async () => {
    const citations = await adoptBriefAt("citations");
    const excerpts = await adoptBriefAt("excerpts");
    const structure = (brief: Brief) =>
      brief.blocks.map((block) => ({
        id: block.id,
        question: block.question,
        status: block.status,
        landingZoneId: block.landingZoneId,
      }));
    expect(structure(citations)).toEqual(structure(excerpts));
  });
});
