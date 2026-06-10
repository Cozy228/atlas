/**
 * Stateless MCP server over streamable HTTP at `/mcp`.
 *
 * Single-message JSON-RPC 2.0 over POST with `application/json` responses
 * (the spec's stateless variant: no session, no SSE stream, nothing for a
 * GET to deliver). The caller's Bearer token passes through unparsed to the
 * Context API client (Bearer pipe, ADR 0001).
 */
import { createServerContextApiClient } from "../httpContextApiClient.js";
import { mcpTools, toolErrorMessage } from "./tools.js";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const MCP_SERVER_INFO = {
  name: "atlas",
  title: "Atlas Context Layer",
  version: "1.0.0",
};

type JsonRpcId = string | number | null;

type JsonRpcMessage = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: JsonRpcId, result: unknown): Response {
  return Response.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: JsonRpcId, code: number, message: string, status = 200): Response {
  return Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status });
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    // Stateless server: no session stream to resume, so GET has nothing to serve.
    return rpcError(null, -32000, "Method Not Allowed: POST a JSON-RPC message.", 405);
  }

  let message: JsonRpcMessage;
  try {
    message = (await request.json()) as JsonRpcMessage;
  } catch {
    return rpcError(null, -32700, "Parse error: body must be a single JSON-RPC message.", 400);
  }
  if (Array.isArray(message)) {
    return rpcError(null, -32600, "Batch requests are not supported; send one message.", 400);
  }

  // Notifications carry no id and get no body.
  if (message.id === undefined || message.method?.startsWith("notifications/")) {
    return new Response(null, { status: 202 });
  }

  switch (message.method) {
    case "initialize":
      return rpcResult(message.id, {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: MCP_SERVER_INFO,
      });
    case "ping":
      return rpcResult(message.id, {});
    case "tools/list":
      return rpcResult(message.id, {
        tools: mcpTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: { readOnlyHint: true },
        })),
      });
    case "tools/call":
      return handleToolCall(message, request);
    default:
      return rpcError(message.id, -32601, `Method not found: ${message.method}`);
  }
}

async function handleToolCall(message: JsonRpcMessage, request: Request): Promise<Response> {
  const id = message.id as JsonRpcId;
  const name = message.params?.name;
  const tool = mcpTools.find((candidate) => candidate.name === name);
  if (!tool) {
    return rpcError(
      id,
      -32602,
      `Unknown tool: ${String(name)}. Available: ${mcpTools.map((t) => t.name).join(", ")}.`,
    );
  }

  const client = createServerContextApiClient({ token: callerBearerToken(request) });
  try {
    const result = await tool.run(message.params?.arguments, client);
    return rpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(result) }],
      structuredContent: result,
    });
  } catch (error) {
    // Tool-level failures are results with isError, not protocol errors.
    return rpcResult(id, {
      content: [{ type: "text", text: toolErrorMessage(tool.name, error) }],
      isError: true,
    });
  }
}

function callerBearerToken(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}
