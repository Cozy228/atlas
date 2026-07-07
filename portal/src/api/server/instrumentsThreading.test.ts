import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { instrumentsMetrics } from "@atlas/context-layer";
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

import { handleMcpRequest } from "./mcp/handler";
import { createInProcessContextApiClient } from "./inProcessContextApi";

/**
 * D2 (real threading) — the channel label must be threaded by the ACTUAL entry
 * points, not just plumbed in a hand-built ctx. Driving the real MCP moment tool
 * and the real in-process Portal loader, the brief they assemble must land its
 * face on the metrics registry. Someone dropping `channel: "mcp"` in `mcp/tools.ts`
 * (or the `"portal"` default in `inProcessContextApi`) turns one of these red.
 *
 * Public-safe fictional data (aws/textract in awsf).
 */

const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  setDevDiscoveryEnv(process.env, { referenceSpace: false });
  // Force the in-process brief handler (no HTTP base URL), so the channel is
  // seated by the entry point rather than re-stamped by the router.
  delete process.env.CONTEXT_API_BASE_URL;
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

/** A brief was assembled on `channel` iff a brief metric carries that label. */
function assembledOnChannel(channel: string): boolean {
  const snapshot = instrumentsMetrics.snapshot();
  return (
    snapshot.histograms.some(
      (h) => h.name === "brief_time_to_brief_ms" && h.labels.channel === channel,
    ) || snapshot.counters.some((c) => c.name === "brief_calls" && c.labels.channel === channel)
  );
}

describe("channel threading through the real entry points (D2)", () => {
  it("the MCP moment tool threads the mcp channel", async () => {
    const rpc = new Request("https://portal.example.com/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "atlas_check_adoption",
          arguments: { service: "aws/textract", landingZones: ["awsf"] },
        },
      }),
    });

    const response = await handleMcpRequest(rpc);
    expect(response.status).toBe(200);
    expect(assembledOnChannel("mcp")).toBe(true);
  });

  it("the Portal in-process loader threads the portal channel by default", async () => {
    const client = createInProcessContextApiClient();
    await client.getBrief("adopt", { landingZones: ["awsf"], service: "aws/textract" }, "excerpts");
    expect(assembledOnChannel("portal")).toBe(true);
  });
});
