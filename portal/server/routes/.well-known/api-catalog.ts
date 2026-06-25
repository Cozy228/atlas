import { buildApiCatalog } from "@/api/server/agentDiscovery";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: unknown): Response =>
  Response.json(buildApiCatalog(resolvePortalOrigin(handlerRequest(event))), {
    headers: { "content-type": "application/linkset+json" },
  });
