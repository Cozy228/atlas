import { buildMcpServerCard } from "@atlas/context-layer/mcp";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: unknown): Response =>
  Response.json(
    buildMcpServerCard(resolvePortalOrigin(handlerRequest(event), { preferEnv: true })),
  );
