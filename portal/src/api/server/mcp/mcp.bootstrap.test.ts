import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";
import { sharedAppsRepository } from "@atlas/context-layer";

import { handleMcpRequest } from "./handler";

/**
 * D1 / D5 — `atlas_bootstrap`: the agent's first call (I6/P20). It answers "who
 * am I here and what can I ask": the resolved situation (the vetted landing-zone
 * SET, its origin, and any scope_drift / scope_unresolved warnings, M11), the
 * tool inventory grouped moment-tools-then-atoms, and the depth contract
 * statement (M9). It is identity/scope discovery only — a by-value scope NEVER
 * writes (M11), and `atlas_explain_error` is Step 7, so bootstrap lists it as
 * not-yet-available rather than fabricating a stub tool (locked decision 5).
 *
 * Red in Batch 0: `atlas_bootstrap`'s `run` throws `unimplemented`, which the MCP
 * handler surfaces as an `isError` tool result with no `structuredContent` — so
 * every behavioral assertion below fails for that reason, never an import/type
 * error. The tools/list registration assertions (explain_error absent; the four
 * moment/bootstrap tools present) are satisfied by the Batch-0 registration
 * itself and are green now — they pin the surface the behavior must fill.
 *
 * Public-safe fictional data only (aws/textract, awsf/azuref, a fictional APP).
 */

const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  setDevDiscoveryEnv(process.env, { referenceSpace: false });
  // Force the in-process fallback so scope vetting runs through the real
  // governance gate (no HTTP hop): unset any Context API base URL.
  delete process.env.CONTEXT_API_BASE_URL;
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

type ToolResult = {
  structuredContent?: unknown;
  isError?: boolean;
  content?: { text: string }[];
};

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const response = await handleMcpRequest(rpc("tools/call", { name, arguments: args }));
  expect(response.status).toBe(200);
  const body = (await response.json()) as { result: ToolResult };
  return body.result;
}

/** The frozen bootstrap output shape (Batch 0 contract). NOT a `Brief` — it is
 *  identity/scope discovery + inventory, so warnings ride the situation here. */
type BootstrapResult = {
  situation: {
    landingZoneIds: string[];
    origin: "by-value" | "by-reference";
    appId?: string;
    warnings: { code: string; message: string }[];
  };
  tools: { moments: string[]; atoms: string[] };
  depth: { default: string; statement: string };
  notYetAvailable: { name: string; reason: string }[];
};

/** Assert the tool call succeeded (unwrap the Batch-0 unimplemented red with a
 *  behavioral message) and return its structured content in the frozen shape. */
function bootstrapOf(result: ToolResult): BootstrapResult {
  expect(result.isError, result.content?.[0]?.text).toBeFalsy();
  expect(result.structuredContent).toBeTruthy();
  return result.structuredContent as BootstrapResult;
}

describe("atlas_bootstrap — resolved situation + inventory (D1)", () => {
  it("echoes the by-value situation: the vetted LZ set and its origin", async () => {
    const data = bootstrapOf(await callTool("atlas_bootstrap", { landingZones: ["awsf"] }));
    expect(data.situation.landingZoneIds).toContain("awsf");
    expect(data.situation.origin).toBe("by-value");
  });

  it("surfaces a scope_drift warning when a by-value scope disagrees with its appId", async () => {
    // Seed a fictional registered APP whose declared zones differ from the
    // by-value declaration, so the `both`-kind reconciliation drifts (M11: value
    // wins, and the conflict is surfaced honestly, never silently).
    await sharedAppsRepository(process.env).put({
      id: "app-orion-checkout",
      name: "Orion Checkout",
      landingZoneIds: ["azuref"],
      serviceSlugs: ["aws/textract"],
      origin: "self-declared",
      declaredAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });

    const data = bootstrapOf(
      await callTool("atlas_bootstrap", {
        landingZones: ["awsf"],
        appId: "app-orion-checkout",
      }),
    );
    // The by-value declaration wins (origin stays by-value)...
    expect(data.situation.origin).toBe("by-value");
    // ...and the drift is surfaced, not swallowed.
    expect(data.situation.warnings.some((warning) => warning.code === "scope_drift")).toBe(true);
  });

  it("groups the tool inventory moment-tools-then-atoms", async () => {
    const data = bootstrapOf(await callTool("atlas_bootstrap", { landingZones: ["awsf"] }));
    // The moment tools are their own group...
    expect(data.tools.moments).toEqual(
      expect.arrayContaining([
        "atlas_check_adoption",
        "atlas_get_my_context",
        "atlas_whats_changed",
      ]),
    );
    // ...distinct from the resource atoms beneath them.
    expect(data.tools.atoms).toEqual(
      expect.arrayContaining([
        "atlas_search_service",
        "atlas_get_source",
        "atlas_get_availability",
        "atlas_get_resource_context",
      ]),
    );
    // The two groups do not overlap (grouping is real, not a flat relabel).
    for (const moment of data.tools.moments) {
      expect(data.tools.atoms).not.toContain(moment);
    }
  });

  it("states the depth contract: citations by default", async () => {
    const data = bootstrapOf(await callTool("atlas_bootstrap", { landingZones: ["awsf"] }));
    expect(data.depth.default).toBe("citations");
    expect(data.depth.statement.length).toBeGreaterThan(0);
  });

  it("a by-value bootstrap never writes — no AppRecord is created (M11)", async () => {
    const repo = sharedAppsRepository(process.env);
    const before = (await repo.list()).length;
    const data = bootstrapOf(await callTool("atlas_bootstrap", { landingZones: ["awsf"] }));
    // It resolved a by-value situation...
    expect(data.situation.origin).toBe("by-value");
    // ...and left the consumer-state store untouched (no upsert-on-read).
    const after = (await repo.list()).length;
    expect(after).toBe(before);
  });
});

describe("atlas_explain_error is Step 7 (D5)", () => {
  it("is absent from tools/list — no fabricated stub tool", async () => {
    const response = await handleMcpRequest(rpc("tools/list"));
    const body = (await response.json()) as { result: { tools: { name: string }[] } };
    const names = body.result.tools.map((tool) => tool.name);
    expect(names).not.toContain("atlas_explain_error");
    // The moment tools that DO exist are listed.
    expect(names).toContain("atlas_bootstrap");
    expect(names).toContain("atlas_check_adoption");
  });

  it("bootstrap lists explain_error as not-yet-available, honestly", async () => {
    const data = bootstrapOf(await callTool("atlas_bootstrap", { landingZones: ["awsf"] }));
    expect(data.notYetAvailable.some((entry) => entry.name.includes("explain_error"))).toBe(true);
  });
});
