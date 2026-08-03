import {
  buildAiCatalog,
  buildApiCatalog,
  buildLlmsTxt,
  buildOauthProtectedResource,
  buildRobotsTxt,
} from "@/api/server/agentDiscovery";
import { buildMcpServerCard } from "@atlas/context-layer/mcp";
import {
  buildAgentOpenApiDocument,
  buildInternalOpenApiDocument,
} from "@/api/server/openapiDocument";
import { resolvePortalOrigin } from "@/api/server/portalOrigin";

export function handleAiCatalog(request: Request): Response {
  return Response.json(buildAiCatalog(resolvePortalOrigin(request)), {
    headers: { "content-type": "application/json" },
  });
}

export function handleApiCatalog(request: Request): Response {
  return Response.json(buildApiCatalog(resolvePortalOrigin(request)), {
    headers: { "content-type": "application/linkset+json" },
  });
}

export function handleMcpServerCard(request: Request): Response {
  return Response.json(buildMcpServerCard(resolvePortalOrigin(request, { preferEnv: true })));
}

export function handleOauthProtectedResource(request: Request): Response {
  return Response.json(
    buildOauthProtectedResource(resolvePortalOrigin(request, { preferEnv: true })),
  );
}

export function handleLlmsTxt(request: Request): Response {
  return new Response(buildLlmsTxt(resolvePortalOrigin(request)), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export function handleAgentOpenApi(request: Request): Response {
  return Response.json(buildAgentOpenApiDocument(resolvePortalOrigin(request)), {
    headers: { "content-type": "application/openapi+json" },
  });
}

export function handleInternalOpenApi(request: Request): Response {
  return Response.json(buildInternalOpenApiDocument(resolvePortalOrigin(request)), {
    headers: { "content-type": "application/openapi+json" },
  });
}

export function handleRobotsTxt(request: Request): Response {
  return new Response(buildRobotsTxt(resolvePortalOrigin(request, { preferEnv: true })), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
