import { buildAgentOpenApiDocument } from "@/api/server/openapiDocument";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: unknown): Response =>
  Response.json(buildAgentOpenApiDocument(resolvePortalOrigin(handlerRequest(event))), {
    headers: { "content-type": "application/openapi+json" },
  });
