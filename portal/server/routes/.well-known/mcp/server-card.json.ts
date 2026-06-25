import type { H3Event } from "nitro";

import { buildMcpServerCard } from "@/api/server/mcp/handler";
import { resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: H3Event): Response =>
  Response.json(buildMcpServerCard(resolvePortalOrigin(event, { preferEnv: true })));
