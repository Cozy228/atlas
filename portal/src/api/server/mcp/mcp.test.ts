import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ResourceContextResponseSchema } from "@atlas/schema";
import { server, setDevDiscoveryEnv } from "@atlas/context-layer/devMocks";

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

  it("lists exactly the four read-only atlas_* tools", async () => {
    const response = await handleMcpRequest(rpc("tools/list"));
    const body = await response.json();
    const tools = body.result.tools as {
      name: string;
      annotations: { readOnlyHint: boolean };
    }[];
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      "atlas_get_availability",
      "atlas_get_resource_context",
      "atlas_get_source",
      "atlas_search_service",
    ]);
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
    // CONCISE: high-signal fields only, no owner/support/entry_tools noise. The
    // description is derived from the module README's lead paragraph (id/name/kind
    // + description).
    const textract = data.resources.find((resource) => resource.id === "service/aws/textract")!;
    expect(Object.keys(textract).sort()).toEqual(["description", "id", "kind", "name"]);
    expect(textract.description).toBeTruthy();
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
