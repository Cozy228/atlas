import type { H3Event } from "nitro";

import { buildOpenApiDocument } from "@/api/server/openapiDocument";
import { resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: H3Event): Response =>
  Response.json(buildOpenApiDocument(resolvePortalOrigin(event)), {
    headers: { "content-type": "application/openapi+json" },
  });
