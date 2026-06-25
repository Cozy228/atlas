import { buildLlmsTxt } from "@/api/server/agentDiscovery";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: unknown): Response =>
  new Response(buildLlmsTxt(resolvePortalOrigin(handlerRequest(event))), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
