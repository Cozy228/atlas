import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { setDevDiscoveryEnv } from "../devMocks";
import { atlasMcpHandler, buildMcpServerCard } from "./server";

const savedEnv = { ...process.env };

beforeAll(() => {
  setDevDiscoveryEnv();
});

afterAll(() => {
  process.env = savedEnv;
});

async function connectedClient() {
  const client = new Client({ name: "atlas-mcp-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL("https://atlas.example.com/mcp"), {
    fetch: (url, init) => atlasMcpHandler.fetch(new Request(url, init)),
  });
  await client.connect(transport);
  return client;
}

describe("Atlas MCP server", () => {
  it("keeps the documented stateless JSON-RPC compatibility path", async () => {
    const response = await atlasMcpHandler.fetch(
      new Request("https://atlas.example.com/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    const event = (await response.text()).split("\n").find((line) => line.startsWith("data: "));
    const body = JSON.parse(event?.slice("data: ".length) ?? "{}") as {
      result: { tools: { name: string }[] };
    };

    expect(response.status).toBe(200);
    expect(body.result.tools.map((tool) => tool.name)).toContain("atlas_search_context");
  });

  it("exposes the three task-shaped read tools through the official SDK", async () => {
    const client = await connectedClient();

    try {
      const result = await client.listTools();
      expect(result.tools.map((tool) => tool.name).sort()).toEqual([
        "atlas_check_availability",
        "atlas_read_context",
        "atlas_search_context",
      ]);
      for (const tool of result.tools) {
        expect(tool.inputSchema).toBeTruthy();
        expect(tool.outputSchema).toBeTruthy();
        expect(tool.annotations?.readOnlyHint).toBe(true);
        expect(tool.annotations?.destructiveHint).toBe(false);
        expect(tool.annotations?.idempotentHint).toBe(true);
      }
    } finally {
      await client.close();
    }
  });

  it("derives the server card from the registered tool metadata", () => {
    const card = buildMcpServerCard("https://atlas.example.com");

    expect(card.transport.url).toBe("https://atlas.example.com/mcp");
    expect(card.tools.map((tool) => tool.name).sort()).toEqual([
      "atlas_check_availability",
      "atlas_read_context",
      "atlas_search_context",
    ]);
  });

  it("searches governed context and returns structured cited excerpts", async () => {
    const client = await connectedClient();

    try {
      const result = await client.callTool({
        name: "atlas_search_context",
        arguments: { query: "textract private subnet requirements" },
      });
      const structured = result.structuredContent as {
        matches: { resource: { id: string }; excerpts: { citations: unknown[] }[] }[];
      };
      const textract = structured.matches.find(
        (match) => match.resource.id === "service/aws/textract",
      );
      expect(textract?.excerpts.some((excerpt) => excerpt.citations.length > 0)).toBe(true);
    } finally {
      await client.close();
    }
  });

  it("reads selected Sections from a canonical resource id", async () => {
    const client = await connectedClient();

    try {
      const result = await client.callTool({
        name: "atlas_read_context",
        arguments: { resource_id: "service/aws/textract", sections: ["network"] },
      });
      const structured = result.structuredContent as {
        requestedSections: string[];
        sections: Record<string, { citations: { sourceId: string }[] }>;
      };
      expect(structured.requestedSections).toEqual(["network"]);
      expect(structured.sections.network?.citations[0]?.sourceId).toBe("textract-module-readme");
    } finally {
      await client.close();
    }
  });

  it("checks structured availability without losing its governing citation", async () => {
    const client = await connectedClient();

    try {
      const result = await client.callTool({
        name: "atlas_check_availability",
        arguments: {
          service_query: "textract",
          zone: "awsf",
          location_id: "us-east-1",
        },
      });
      const structured = result.structuredContent as {
        total: number;
        citation: { source_id: string };
        services: { service_id: string; availability: Record<string, unknown> }[];
      };
      expect(structured.total).toBeGreaterThan(0);
      expect(structured.services[0]?.service_id).toBe("textract");
      expect(structured.services[0]?.availability).toHaveProperty("us-east-1");
      expect(structured.citation.source_id).toBe("availability-matrix");
    } finally {
      await client.close();
    }
  });
});
