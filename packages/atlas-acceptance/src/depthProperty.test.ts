import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BriefSchema, type Brief, type BriefDepth } from "@atlas/schema";
import {
  createResolutionContext,
  handleBriefRequest,
  handleHttpRequest,
  instrumentsMetrics,
} from "@atlas/context-layer";
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

/**
 * D7 — the depth acceptance property (M9/P28). The SAME brief at `citations` vs
 * `excerpts`: the citations tier carries ZERO excerpt bodies, is a strict subset
 * in evidence content, and its estimated payload tokens are STRICTLY SMALLER; and
 * both the HTTP and in-process faces agree per tier (the transport-guard
 * extension). Driven against the MSW discovery fixtures (`aws/textract` in `awsf`).
 */

const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  setDevDiscoveryEnv();
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

/** The HTTP face: the raw router serializes a JSON Brief on the wire. */
async function briefViaHttp(depth: BriefDepth): Promise<Brief> {
  const response = await handleHttpRequest({
    method: "GET",
    path: "/api/briefs/adopt",
    query: { service: "aws/textract", landingZones: "awsf", depth },
  });
  expect(response.status).toBe(200);
  return BriefSchema.parse(JSON.parse(response.body));
}

/** The in-process face: the same handler the Portal loader / MCP tool invoke. */
async function briefInProcess(depth: BriefDepth): Promise<Brief> {
  const ctx = await createResolutionContext({
    scope: { kind: "by-value", landingZones: ["awsf"] },
  });
  const result = await handleBriefRequest("adopt", ctx, { service: "aws/textract", depth });
  return BriefSchema.parse(result.body);
}

function allExcerpts(brief: Brief): (string | null)[] {
  return brief.blocks.flatMap((block) => block.evidence.map((evidence) => evidence.excerpt));
}

describe("brief depth acceptance property (D7)", () => {
  it("citations carries zero excerpt bodies; excerpts inlines them", async () => {
    const citations = await briefViaHttp("citations");
    const excerpts = await briefViaHttp("excerpts");

    expect(allExcerpts(citations).every((excerpt) => excerpt === null)).toBe(true);
    // The excerpts tier is materially richer: it inlines at least one body.
    expect(allExcerpts(excerpts).filter((excerpt) => excerpt !== null).length).toBeGreaterThan(0);
  });

  it("citations is a strict subset in evidence content, with strictly smaller est-tokens", async () => {
    const citations = await briefViaHttp("citations");
    const excerpts = await briefViaHttp("excerpts");

    // Same structure — citations only drops the bodies (a subset, never a different
    // shape): identical blocks and identical per-evidence citations.
    expect(citations.blocks.length).toBe(excerpts.blocks.length);
    for (let i = 0; i < citations.blocks.length; i += 1) {
      const citeBlock = citations.blocks[i];
      const excBlock = excerpts.blocks[i];
      expect(citeBlock.evidence.map((e) => e.citations)).toEqual(
        excBlock.evidence.map((e) => e.citations),
      );
    }

    const citationsTokens = instrumentsMetrics.estimateTokens(JSON.stringify(citations));
    const excerptsTokens = instrumentsMetrics.estimateTokens(JSON.stringify(excerpts));
    expect(citationsTokens).toBeLessThan(excerptsTokens);
  });

  it("both faces agree per tier (transport guard)", async () => {
    for (const depth of ["citations", "excerpts"] as const) {
      const http = await briefViaHttp(depth);
      const inProcess = await briefInProcess(depth);
      // `resolvedAt` is a per-render resolution time (ADR-0013 §3), not part of the
      // value contract — normalize it before the byte-for-byte face comparison.
      expect({ ...http, resolvedAt: "" }).toEqual({ ...inProcess, resolvedAt: "" });
    }
  });
});
