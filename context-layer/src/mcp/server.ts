import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";

import { ATLAS_MCP_TOOL_SUMMARIES, registerAtlasMcpTools } from "./tools";

export const MCP_SERVER_INFO = {
  name: "atlas",
  title: "Atlas Context Layer",
  version: "0.2.0",
} as const;

export function createAtlasMcpServer(): McpServer {
  const server = new McpServer(MCP_SERVER_INFO);
  registerAtlasMcpTools(server);
  return server;
}

export const atlasMcpHandler = createMcpHandler(createAtlasMcpServer);

export function buildMcpServerCard(origin: string) {
  return {
    ...MCP_SERVER_INFO,
    description:
      "Read-only MCP access to governed, live-resolved Atlas context with citations and source warnings.",
    transport: { type: "streamable-http", url: `${origin}/mcp` },
    authentication: {
      scheme: "bearer",
      description:
        "Optional opaque Bearer token forwarded to source resolution without parsing or persistence.",
    },
    capabilities: { tools: {} },
    tools: ATLAS_MCP_TOOL_SUMMARIES,
  };
}
