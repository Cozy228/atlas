import { buildInternalOpenApiDocument } from "@/api/server/openapiDocument";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";

// The complete internal contract (proposal §6.7). A specific filesystem route so
// it wins over the `/api/[...]` Context-API catch-all; not advertised to agents.
export default (event: unknown): Response =>
  Response.json(buildInternalOpenApiDocument(resolvePortalOrigin(handlerRequest(event))), {
    headers: { "content-type": "application/openapi+json" },
  });
