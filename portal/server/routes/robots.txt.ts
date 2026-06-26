import { buildRobotsTxt } from "@/api/server/agentDiscovery";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: unknown): Response =>
  new Response(buildRobotsTxt(resolvePortalOrigin(handlerRequest(event), { preferEnv: true })), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
