import { buildMcpServerCard } from "@/api/server/mcp/handler";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: unknown): Response =>
  Response.json(
    buildMcpServerCard(resolvePortalOrigin(handlerRequest(event), { preferEnv: true })),
  );
