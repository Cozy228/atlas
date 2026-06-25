import { describe, expect, it } from "vitest";
import { ContextBundleResponseSchema } from "@atlas/schema";

import { serverContextApiClient } from "../serverContextApiClient";
import { buildMcpServerCard, handleMcpRequest } from "./handler";
import { mcpTools } from "./tools";

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
      "atlas_get_context_bundle",
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
  it("atlas_search_service resolves a query to semantic topic ids", async () => {
    const result = await callTool("atlas_search_service", { query: "textract" });
    const data = result.structuredContent as {
      topics: { id: string; name: string; description: string }[];
      total: number;
    };
    expect(data.topics.map((topic) => topic.id)).toContain("aws-textract");
    // CONCISE: high-signal fields only, no owner/support/entry_tools noise.
    expect(Object.keys(data.topics[0]!).sort()).toEqual([
      "description",
      "id",
      "name",
      "topic_type",
    ]);
  });

  it("atlas_get_source returns the registry record by semantic id", async () => {
    const result = await callTool("atlas_get_source", {
      source_id: "textract-module-readme",
    });
    const data = result.structuredContent as { source: { id: string; authority_level: string } };
    expect(data.source.id).toBe("textract-module-readme");
    expect(data.source.authority_level).toBe("authoritative");
  });

  it("atlas_get_availability filters by zone and service", async () => {
    const result = await callTool("atlas_get_availability", {
      zone: "aws",
      service_query: "textract",
    });
    const data = result.structuredContent as {
      services: { zone: string; service_id: string; availability: Record<string, unknown> }[];
    };
    expect(data.services.length).toBeGreaterThan(0);
    for (const service of data.services) {
      expect(service.zone).toBe("aws");
      expect(service.availability).toBeTypeOf("object");
    }
  });

  it("atlas_get_context_bundle returns the same governed bundle the Portal gets, with Citations", async () => {
    const result = await callTool("atlas_get_context_bundle", {
      topic_id: "aws-textract",
      response_format: "DETAILED",
    });
    const bundle = ContextBundleResponseSchema.parse(result.structuredContent);
    const portalBundle = await serverContextApiClient.getContextBundle({
      topic_id: "aws-textract",
    });
    expect({ ...bundle, bundle_id: "x" }).toEqual({ ...portalBundle, bundle_id: "x" });
  });

  it("CONCISE bundles keep the Citation on every excerpt and pass warnings through", async () => {
    const result = await callTool("atlas_get_context_bundle", { topic_id: "aws-textract" });
    const data = result.structuredContent as {
      excerpts: { source_id: string; citation: { source_id: string; label: string } }[];
      warnings: unknown[];
    };
    expect(data.excerpts.length).toBeGreaterThan(0);
    for (const excerpt of data.excerpts) {
      expect(excerpt.citation.source_id).toBe(excerpt.source_id);
      expect(excerpt.citation.label.length).toBeGreaterThan(0);
    }
    expect(Array.isArray(data.warnings)).toBe(true);
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
