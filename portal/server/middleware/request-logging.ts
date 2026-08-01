import { logger, resolveRequestId, withHttpRequestLogging } from "@atlas/logging";

import { handlerRequest } from "@/api/server/portalOrigin";

const log = logger("portal.http");

export default async (event: unknown, next: () => unknown): Promise<unknown> => {
  const request = handlerRequest(event);
  if (!request) return next();

  const requestId = resolveRequestId(request.headers);
  const method = request.method || "GET";
  const route = routePattern(safePath(request.url));

  const result = await withHttpRequestLogging(
    {
      log,
      requestId,
      method,
      route,
      statusCode: (response) => responseStatus(event, response),
      successLevel: isHighVolumePath(route) ? "debug" : "info",
    },
    async () => next(),
  );
  setRequestIdHeader(event, result, requestId);
  return result;
};

function safePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}

function routePattern(path: string): string {
  const patterns: Array<[RegExp, string]> = [
    [/^\/api\/sources\/[^/]+$/, "/api/sources/:sourceId"],
    [/^\/api\/resources\/[^/]+\/.+\/record$/, "/api/resources/:kind/:slug/record"],
    [/^\/api\/resources\/[^/]+\/.+$/, "/api/resources/:kind/:slug"],
    [/^\/resources\/[^/]+\/.+$/, "/resources/:kind/:slug"],
    [/^\/guidance\/[^/]+$/, "/guidance/:guidanceId"],
    [/^\/policies\/[^/]+$/, "/policies/:policyId"],
    [/^\/releases\/[^/]+$/, "/releases/:releaseId"],
    [/^\/service\/[^/]+\/[^/]+$/, "/service/:provider/:id"],
    [/^\/sources\/[^/]+$/, "/sources/:sourceId"],
    [/^\/(?:_server|_serverFn)\/.+$/, "/_server/:function"],
  ];
  return patterns.find(([pattern]) => pattern.test(path))?.[1] ?? path;
}

function responseStatus(event: unknown, result: unknown): number {
  if (result instanceof Response) return result.status;
  return (
    (event as { res?: { status?: number; statusCode?: number } }).res?.statusCode ??
    (event as { res?: { status?: number } }).res?.status ??
    200
  );
}

function setRequestIdHeader(event: unknown, result: unknown, requestId: string): void {
  const eventHeaders = (event as { res?: { headers?: Headers } }).res?.headers;
  if (eventHeaders) {
    eventHeaders.set("x-request-id", requestId);
    return;
  }
  if (result instanceof Response) {
    try {
      result.headers.set("x-request-id", requestId);
    } catch {
      // Some platform responses expose immutable headers. Logging must not change the response.
    }
  }
}

function isHighVolumePath(path: string): boolean {
  return path === "/health" || path.startsWith("/assets/") || path.startsWith("/@fs/");
}
