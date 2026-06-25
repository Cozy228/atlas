import { buildOauthProtectedResource } from "@/api/server/agentDiscovery";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";

export default (event: unknown): Response =>
  Response.json(
    buildOauthProtectedResource(resolvePortalOrigin(handlerRequest(event), { preferEnv: true })),
  );
