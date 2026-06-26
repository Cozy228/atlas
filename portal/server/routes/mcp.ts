/**
 * Read-only MCP facade on the Portal origin. See `src/api/server/mcp/`.
 */
import { handleMcpRequest } from "@/api/server/mcp/handler";
import { handlerRequest } from "@/api/server/portalOrigin";

export default (event: unknown): Promise<Response> => {
  const request = handlerRequest(event);
  if (!request) return Promise.resolve(new Response("Bad Request", { status: 400 }));
  return handleMcpRequest(request);
};
