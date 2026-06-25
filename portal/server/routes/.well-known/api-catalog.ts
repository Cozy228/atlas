import type { H3Event } from "nitro";

import { buildApiCatalog } from "@/api/server/agentDiscovery";
import { resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: H3Event): Response =>
  Response.json(buildApiCatalog(resolvePortalOrigin(event)), {
    headers: { "content-type": "application/linkset+json" },
  });
