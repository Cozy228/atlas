import type { H3Event } from "nitro";

import { buildOauthProtectedResource } from "@/api/server/agentDiscovery";
import { resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: H3Event): Response =>
  Response.json(buildOauthProtectedResource(resolvePortalOrigin(event, { preferEnv: true })));
