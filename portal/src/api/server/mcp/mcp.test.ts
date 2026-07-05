import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ResourceContextResponseSchema } from "@atlas/schema";
import {
  DEV_CONFLUENCE_BASE_URL,
  DEV_TERRAFORM_BASE_URL,
  server,
  setDevDiscoveryEnv,
} from "@atlas/context-layer/devMocks";

import { serverContextApiClient } from "../serverContextApiClient";
import { buildMcpServerCard, handleMcpRequest } from "./handler";
import { mcpTools } from "./tools";

// The tools read the discovery-derived catalog + the LZ-aware availability grid
// (plan 018 G5 / 021 G3). Boot the MSW source-space and point EVERY discovery
// channel at it so the registry/resources + availability resolve live.
const savedEnv = { ...process.env };
beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" });
  // Reference space off: the resource-context parity test compares two live
  // projections, and reference discovery stamps a run-time timestamp.
  setDevDiscoveryEnv(process.env, { referenceSpace: false });
});
afterAll(() => {
  server.close();
  process.env = savedEnv;
});

function rpc(method: string, params?: Record<string, unknown>, id: number = 1): Request {
  return new Request("https://portal.example.com/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
}

async function callTool(name: string, args: Record<string, unknown>) {
  const response = await handleMcpRequest(rpc("tools/call", { name, arguments: args }));
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    result: { structuredContent?: unknown; isError?: boolean; content: { text: string }[] };
  };
  return body.result;
}

describe("mcp protocol surface", () => {
  it("initializes as a tools-only streamable-http server", async () => {
    const response = await handleMcpRequest(rpc("initialize"));
    const body = await response.json();
    expect(body.result.serverInfo.name).toBe("atlas");
    expect(body.result.capabilities).toEqual({ tools: {} });
  });

  it("accepts notifications with 202 and rejects GET", async () => {
    const notification = new Request("https://portal.example.com/mcp", {
      method: "POST",
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    });
    expect((await handleMcpRequest(notification)).status).toBe(202);
    expect((await handleMcpRequest(new Request("https://portal.example.com/mcp"))).status).toBe(
      405,
    );
  });

  it("lists the read-only atlas_* tools — the four atoms plus the Step-5 moment tools", async () => {
    // Step 5 (front doors) adds `atlas_bootstrap` + the three moment tools to
    // tools/list — a legitimate growth of the surface. The four original atoms
    // remain (agents may have them memorized); `atlas_explain_error` is Step 7
    // and deliberately absent (locked decision 5). Every listed tool stays
    // read-only.
    const response = await handleMcpRequest(rpc("tools/list"));
    const body = await response.json();
    const tools = body.result.tools as {
      name: string;
      annotations: { readOnlyHint: boolean };
    }[];
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "atlas_bootstrap",
      "atlas_check_adoption",
      "atlas_get_availability",
      "atlas_get_my_context",
      "atlas_get_resource_context",
      "atlas_get_source",
      "atlas_search_service",
      "atlas_whats_changed",
    ]);
    expect(tools.map((tool) => tool.name)).not.toContain("atlas_explain_error");
    for (const tool of tools) {
      expect(tool.name).toMatch(/^atlas_/);
      expect(tool.annotations.readOnlyHint).toBe(true);
    }
  });

  it("has no write-shaped tool", () => {
    for (const tool of mcpTools) {
      expect(tool.name).not.toMatch(/create|update|delete|write|put|post|submit|set_/);
    }
    // The feedback mutation endpoint is deliberately NOT exposed over MCP.
    expect(mcpTools.some((tool) => tool.name.includes("feedback"))).toBe(false);
  });
});

describe("mcp tools against the pilot fixtures", () => {
  it("atlas_search_service resolves a query to canonical resource ids", async () => {
    const result = await callTool("atlas_search_service", { query: "textract" });
    const data = result.structuredContent as {
      resources: { id: string; name: string; kind: string; description?: string }[];
      total: number;
    };
    expect(data.resources.map((resource) => resource.id)).toContain("service/aws/textract");
    // CONCISE: high-signal fields only, no owner/support/entry_tools noise. Since
    // discovery is list-only (plan 0.2.0), the module-README-derived description is
    // an honest gap on the search/list surface until a detail read — so the concise
    // shape is id/name/kind only.
    const textract = data.resources.find((resource) => resource.id === "service/aws/textract")!;
    expect(Object.keys(textract).sort()).toEqual(["id", "kind", "name"]);
    expect(textract.description).toBeUndefined();
  });

  it("atlas_get_source returns the registry record by semantic id", async () => {
    const result = await callTool("atlas_get_source", {
      source_id: "textract-module-readme",
    });
    const data = result.structuredContent as { source: { id: string; source_class: string } };
    expect(data.source.id).toBe("textract-module-readme");
    expect(data.source.source_class).toBe("terraform-module");
  });

  it("atlas_get_availability filters by zone and service, carrying its Citation", async () => {
    const result = await callTool("atlas_get_availability", {
      zone: "awsf",
      service_query: "textract",
    });
    const data = result.structuredContent as {
      services: { zone: string; service_id: string; availability: Record<string, unknown> }[];
      citation: { source_id: string; label: string; location: string };
    };
    expect(data.services.length).toBeGreaterThan(0);
    for (const service of data.services) {
      expect(service.zone).toBe("awsf");
      expect(service.availability).toBeTypeOf("object");
    }
    // The grid reads through the one cited source of record (plan 014).
    expect(data.citation.source_id).toBe("availability-matrix");
    expect(data.citation.label.length).toBeGreaterThan(0);
    // The read carries the governing source's location (the per-LZ availability
    // page id since plan 021 G3); only that it is cited matters here.
    expect(data.citation.location.length).toBeGreaterThan(0);
  });

  it("atlas_get_resource_context returns the same projection the Portal gets", async () => {
    const result = await callTool("atlas_get_resource_context", {
      kind: "service",
      slug: "aws/textract",
      response_format: "DETAILED",
    });
    const projection = ResourceContextResponseSchema.parse(result.structuredContent);
    const portalProjection = await serverContextApiClient.getResourceContext(
      "service",
      "aws/textract",
    );
    expect({ ...projection, resolvedAt: "x" }).toEqual({ ...portalProjection, resolvedAt: "x" });
  });

  it("CONCISE projections keep Citations on every Section and pass warnings through", async () => {
    const result = await callTool("atlas_get_resource_context", {
      kind: "service",
      slug: "aws/textract",
    });
    const data = result.structuredContent as {
      sections: { section: string; citations: { sourceId: string }[] }[];
    };
    expect(data.sections.length).toBeGreaterThan(0);
    for (const section of data.sections) {
      for (const citation of section.citations) {
        expect(citation.sourceId.length).toBeGreaterThan(0);
      }
    }
  });

  it("failed calls return actionable isError results with a valid example", async () => {
    const result = await callTool("atlas_get_source", { source_id: "does-not-exist" });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain("source_not_found");
    expect(result.content[0]!.text).toContain(`{"source_id": "textract-module-readme"}`);
  });
});

describe("mcp governance gate (Step 1)", () => {
  it("D4: the in-process fallback threads the caller Bearer to the upstream source fetch", async () => {
    // Force the in-process fallback: no CONTEXT_API_BASE_URL means the tool
    // call builds the in-process client rather than the HTTP one.
    delete process.env.CONTEXT_API_BASE_URL;

    const token = "fictional-mcp-caller-token-456";
    const upstreamAuthorization: (string | null)[] = [];
    server.events.on("request:start", ({ request }) => {
      if (
        request.url.startsWith(DEV_TERRAFORM_BASE_URL) ||
        request.url.startsWith(DEV_CONFLUENCE_BASE_URL)
      ) {
        upstreamAuthorization.push(request.headers.get("authorization"));
      }
    });

    try {
      const request = new Request("https://portal.example.com/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 41,
          method: "tools/call",
          params: {
            name: "atlas_get_resource_context",
            arguments: { kind: "service", slug: "aws/textract", response_format: "DETAILED" },
          },
        }),
      });
      const response = await handleMcpRequest(request);
      expect(response.status).toBe(200);

      // The caller's opaque Bearer (ADR-0001) must reach the resolver's
      // ctx.token and therefore the upstream source fetch — the in-process
      // fallback may not silently drop it (Step 1 D4). The caller-bearer
      // cache key is unique to this test, so at least one live fetch happens.
      expect(upstreamAuthorization.length).toBeGreaterThan(0);
      expect(upstreamAuthorization).toContain(`Bearer ${token}`);
    } finally {
      server.events.removeAllListeners("request:start");
    }
  });
});

describe("mcp server card", () => {
  it("lists exactly the implemented tools — no phantom tools", () => {
    const card = buildMcpServerCard("https://portal.example.com");

    expect(card.transport).toEqual({
      type: "streamable-http",
      url: "https://portal.example.com/mcp",
    });
    expect(card.tools.map((tool) => tool.name)).toEqual(mcpTools.map((tool) => tool.name));
    for (const [index, tool] of card.tools.entries()) {
      expect(tool.description).toBe(mcpTools[index]!.description);
    }
  });
});
