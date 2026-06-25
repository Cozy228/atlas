import type { H3Event } from "nitro";

import { buildRobotsTxt } from "@/api/server/agentDiscovery";
import { resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: H3Event): Response =>
  new Response(buildRobotsTxt(resolvePortalOrigin(event, { preferEnv: true })), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
