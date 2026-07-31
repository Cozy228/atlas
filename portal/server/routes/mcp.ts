/** Host the Context Layer-owned MCP adapter on the Portal origin. */
import { atlasMcpHandler } from "@atlas/context-layer/mcp";
import { handlerRequest } from "@/api/server/portalOrigin";

export default (event: unknown): Promise<Response> => {
  const request = handlerRequest(event);
  if (!request) return Promise.resolve(new Response("Bad Request", { status: 400 }));
  return atlasMcpHandler.fetch(request);
};
