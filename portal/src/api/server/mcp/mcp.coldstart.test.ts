import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BriefSchema, ResourceContextResponseSchema, type Brief } from "@atlas/schema";
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

import { handleMcpRequest } from "./handler";

/**
 * D6 — the agent cold-start drill (acceptance D). An agent that has never seen
 * Atlas, holding only a repo-manifest-shaped scope, reaches a cited answer with
 * ZERO human priming and ZERO registration: manifest scope → `tools/list` →
 * `atlas_bootstrap` (who am I / what can I ask) → one moment tool (the adopt
 * brief) → follow ONE citation down into an existing resource atom for the body.
 * Every hop is a real HTTP-shaped JSON-RPC request through `handleMcpRequest`,
 * over the MSW discovery fixtures — the same transport a corp-laptop agent hits
 * at `/mcp` (A1).
 *
 * "Zero priming" is load-bearing: the `{kind, slug}` handed to the resource atom
 * is DERIVED from the brief's own evidence, never hardcoded by the test.
 *
 * Red in Batch 0: the `atlas_bootstrap` and moment-tool hops throw
 * `unimplemented` (surfaced as `isError`), so the drill fails at the first
 * unimplemented hop — behaviorally, never an import/type error. The `tools/list`
 * and resource-atom hops already work and pin the ends of the flow.
 *
 * Public-safe fictional data only.
 */

const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  setDevDiscoveryEnv(process.env, { referenceSpace: false });
  delete process.env.CONTEXT_API_BASE_URL; // in-process governed reads, like /mcp in prod
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

let nextId = 1;
function rpc(method: string, params?: Record<string, unknown>): Request {
  return new Request("https://portal.example.com/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
}

type ToolResult = { structuredContent?: unknown; isError?: boolean; content?: { text: string }[] };

async function listToolNames(): Promise<string[]> {
  const response = await handleMcpRequest(rpc("tools/list"));
  const body = (await response.json()) as { result: { tools: { name: string }[] } };
  return body.result.tools.map((tool) => tool.name);
}

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const response = await handleMcpRequest(rpc("tools/call", { name, arguments: args }));
  expect(response.status).toBe(200);
  const body = (await response.json()) as { result: ToolResult };
  return body.result;
}

/** Split a canonical evidence resourceId (`{kind}/{slug}`) into the resource
 *  atom's args — the "follow the citation" step, derived, never hardcoded. */
function resourceRef(resourceId: string): { kind: string; slug: string } {
  const slash = resourceId.indexOf("/");
  expect(slash, `resourceId "${resourceId}" is not {kind}/{slug}`).toBeGreaterThan(0);
  return { kind: resourceId.slice(0, slash), slug: resourceId.slice(slash + 1) };
}

describe("agent cold-start drill (D6)", () => {
  it("manifest scope → tools/list → bootstrap → adopt brief → follow a citation to a resource atom", async () => {
    // The only input: a repo-manifest-shaped scope (by value, M11). No human.
    const manifestScope = { landingZones: ["awsf"], services: ["aws/textract"] };

    // 1) Discover the surface. The moment tools + atoms are advertised, including
    //    the Step-7 debug moment `atlas_explain_error` (M7 floor; reviewer ruling
    //    2026-07-07 registers it like the other moment tools).
    const toolNames = await listToolNames();
    expect(toolNames).toContain("atlas_bootstrap");
    expect(toolNames).toContain("atlas_check_adoption");
    expect(toolNames).toContain("atlas_get_resource_context");
    expect(toolNames).toContain("atlas_explain_error");

    // 2) Bootstrap: who am I here, what can I ask.
    const bootstrap = await callTool("atlas_bootstrap", manifestScope);
    expect(bootstrap.isError, bootstrap.content?.[0]?.text).toBeFalsy();
    const situation = (bootstrap.structuredContent as { situation: { landingZoneIds: string[] } })
      .situation;
    expect(situation.landingZoneIds).toContain("awsf");

    // 3) One moment tool: the adopt brief for the target service in scope.
    const adoptResult = await callTool("atlas_check_adoption", {
      service: "aws/textract",
      landingZones: manifestScope.landingZones,
    });
    expect(adoptResult.isError, adoptResult.content?.[0]?.text).toBeFalsy();
    const brief: Brief = BriefSchema.parse(adoptResult.structuredContent);

    // Default depth=citations: the brief carries citations, not bodies — the
    // agent follows a citation down for the body.
    const evidence = brief.blocks.flatMap((block) => block.evidence);
    expect(evidence.length).toBeGreaterThan(0);
    const firstEvidence = evidence[0]!;
    expect(firstEvidence.excerpt).toBeNull();
    expect(firstEvidence.citations.length).toBeGreaterThan(0);

    // 4) Follow ONE citation into the resource atom — {kind, slug} derived from
    //    the brief's own evidence, so this is genuinely zero-priming.
    const ref = resourceRef(firstEvidence.resourceId);
    const atomResult = await callTool("atlas_get_resource_context", {
      kind: ref.kind,
      slug: ref.slug,
      response_format: "DETAILED",
    });
    expect(atomResult.isError, atomResult.content?.[0]?.text).toBeFalsy();
    const projection = ResourceContextResponseSchema.parse(atomResult.structuredContent);
    expect(projection.resource.id).toBe(firstEvidence.resourceId);
  });
});
