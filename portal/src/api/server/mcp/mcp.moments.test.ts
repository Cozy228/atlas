import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BriefSchema, type Brief, type ChangeEvent } from "@atlas/schema";
import { handleHttpRequest, sharedEventsRepository } from "@atlas/context-layer";
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

import { handleMcpRequest } from "./handler";

/**
 * D2 / D3 / D4 — the three moment tools are THIN WRAPPERS over the Step-4 brief
 * handlers (P13/I3): the SAME code path as `GET /api/briefs/{moment}`, never a
 * second assembly. So the tool result Brief must equal the endpoint's Brief for
 * the same scope (D2), default `depth=citations` with no excerpt bodies while
 * `depth:"excerpts"` adds them (D3/M9), and `atlas_whats_changed` must thread
 * `since=` and return the scoped Step-2 feed's events through the change brief
 * (D4/M8) — the machine-derived feed, never the editorial What's New.
 *
 * Red in Batch 0: each moment tool's `run` throws `unimplemented`, surfaced by
 * the handler as an `isError` result with no `structuredContent`; every
 * behavioral assertion fails for that reason, never an import/type error.
 *
 * Public-safe fictional data only (aws/textract, cloudx/*, awsf/azuref).
 */

const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  setDevDiscoveryEnv(process.env, { referenceSpace: false });
  delete process.env.CONTEXT_API_BASE_URL; // force the in-process brief handler
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

function rpc(method: string, params?: Record<string, unknown>, id = 1): Request {
  return new Request("https://portal.example.com/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

type ToolResult = { structuredContent?: unknown; isError?: boolean; content?: { text: string }[] };

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const response = await handleMcpRequest(rpc("tools/call", { name, arguments: args }));
  expect(response.status).toBe(200);
  const body = (await response.json()) as { result: ToolResult };
  return body.result;
}

/** Unwrap a moment tool's Brief (fails behaviorally on the Batch-0 unimplemented
 *  red, with the thrown message as the failure text). */
function briefOf(result: ToolResult): Brief {
  expect(result.isError, result.content?.[0]?.text).toBeFalsy();
  return BriefSchema.parse(result.structuredContent);
}

/** Read the endpoint Brief the tool must equal. */
async function endpointBrief(moment: string, query: Record<string, string>): Promise<Brief> {
  const response = await handleHttpRequest({ method: "GET", path: `/api/briefs/${moment}`, query });
  expect(response.status).toBe(200);
  return BriefSchema.parse(JSON.parse(response.body));
}

/** Top-level `resolvedAt` is a per-call resolution time; normalize it before an
 *  equality across two faces (mirrors the Step-4 contract guard). */
function stripResolvedAt(brief: Brief): Brief {
  return { ...brief, resolvedAt: "x" };
}

function changeEvent(id: string, zone: string, derivedAt: string): ChangeEvent {
  return {
    id,
    class: "service-added",
    subject: { kind: "service", id: `cloudx/${id}` },
    landingZoneIds: [zone],
    rootId: `availability:${zone}`,
    graphVersionFrom: "v0",
    graphVersionTo: "v1",
    derivedAt,
  };
}

describe("moment tools are thin wrappers — Brief equivalence (D2)", () => {
  it("atlas_check_adoption ≡ GET /api/briefs/adopt for the same scope", async () => {
    const tool = briefOf(
      await callTool("atlas_check_adoption", {
        service: "aws/textract",
        landingZones: ["awsf"],
      }),
    );
    const endpoint = await endpointBrief("adopt", {
      service: "aws/textract",
      landingZones: "awsf",
    });
    expect(tool.moment).toBe("adopt");
    expect(stripResolvedAt(tool)).toEqual(stripResolvedAt(endpoint));
  });

  it("atlas_get_my_context ≡ GET /api/briefs/build for the same scope", async () => {
    const tool = briefOf(await callTool("atlas_get_my_context", { landingZones: ["awsf"] }));
    const endpoint = await endpointBrief("build", { landingZones: "awsf" });
    expect(tool.moment).toBe("build");
    expect(stripResolvedAt(tool)).toEqual(stripResolvedAt(endpoint));
  });

  it("atlas_whats_changed ≡ GET /api/briefs/change for the same scope", async () => {
    await sharedEventsRepository(process.env).append([
      changeEvent("parser", "awsf", "2026-07-01T00:00:00.000Z"),
    ]);
    const tool = briefOf(await callTool("atlas_whats_changed", { landingZones: ["awsf"] }));
    const endpoint = await endpointBrief("change", { landingZones: "awsf" });
    expect(tool.moment).toBe("change");
    expect(stripResolvedAt(tool)).toEqual(stripResolvedAt(endpoint));
  });
});

describe("moment tools default depth=citations (D3)", () => {
  it("citations (default): every evidence carries citations but NO excerpt body", async () => {
    const brief = briefOf(
      await callTool("atlas_check_adoption", { service: "aws/textract", landingZones: ["awsf"] }),
    );
    const evidence = brief.blocks.flatMap((block) => block.evidence);
    expect(evidence.length).toBeGreaterThan(0);
    for (const item of evidence) {
      expect(item.excerpt).toBeNull();
      expect(item.citations.length).toBeGreaterThan(0);
    }
  });

  it('depth:"excerpts" adds resolved section bodies', async () => {
    const brief = briefOf(
      await callTool("atlas_check_adoption", {
        service: "aws/textract",
        landingZones: ["awsf"],
        depth: "excerpts",
      }),
    );
    const withBodies = brief.blocks
      .flatMap((block) => block.evidence)
      .filter((item) => item.excerpt !== null);
    expect(withBodies.length).toBeGreaterThan(0);
  });
});

describe("atlas_whats_changed threads the scoped feed (D4)", () => {
  const EARLY = changeEvent("early-svc", "awsf", "2026-07-01T00:00:00.000Z");
  const LATE = changeEvent("late-svc", "awsf", "2026-07-03T00:00:00.000Z");
  const OTHER_ZONE = changeEvent("azure-svc", "azuref", "2026-07-02T00:00:00.000Z");

  it("returns the scope's events through the change brief, excluding out-of-scope events", async () => {
    await sharedEventsRepository(process.env).append([EARLY, LATE, OTHER_ZONE]);
    const brief = briefOf(await callTool("atlas_whats_changed", { landingZones: ["awsf"] }));
    const json = JSON.stringify(brief);
    // The in-scope (awsf) events surface...
    expect(json).toContain("cloudx/early-svc");
    expect(json).toContain("cloudx/late-svc");
    // ...and the out-of-scope (azuref) event is filtered by the scoped feed.
    expect(json).not.toContain("cloudx/azure-svc");
    expect(brief.blocks.length).toBeGreaterThan(0);
  });

  it("since=<cursor> reads incrementally (later events only)", async () => {
    await sharedEventsRepository(process.env).append([EARLY, LATE, OTHER_ZONE]);
    // The feed cursor is the documented `${derivedAt}#${id}` walk key; anything at
    // or before EARLY is behind the cursor, so only LATE remains.
    const since = `${EARLY.derivedAt}#${EARLY.id}`;
    const brief = briefOf(await callTool("atlas_whats_changed", { landingZones: ["awsf"], since }));
    const json = JSON.stringify(brief);
    expect(json).toContain("cloudx/late-svc");
    expect(json).not.toContain("cloudx/early-svc");
  });
});
