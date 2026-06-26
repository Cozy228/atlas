import { buildAiCatalog } from "@/api/server/agentDiscovery";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";

// Capability discovery (proposal §8). The `api-catalog` linkset alias stays for
// RFC 9264 clients; this is the single-API-entry capability catalog agents read.
export default (event: unknown): Response =>
  Response.json(buildAiCatalog(resolvePortalOrigin(handlerRequest(event))), {
    headers: { "content-type": "application/json" },
  });
