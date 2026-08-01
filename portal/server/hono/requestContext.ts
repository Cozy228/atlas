import { randomUUID } from "node:crypto";

import { resolvePortalOrigin } from "@/api/server/portalOrigin";

export type RequestPrincipal = {
  subject: string;
  tenantId?: string;
  displayName?: string;
  email?: string;
  roles: string[];
  groups?: string[];
  issuedAt?: number;
  expiresAt?: number;
};

export type RequestContext = {
  requestId: string;
  receivedAt: number;
  abortSignal: AbortSignal;
  rawHost?: string;
  forwardedHost?: string;
  forwardedProto?: string;
  publicOrigin: string;
  principal: RequestPrincipal | null;
  authSource: "entra" | "service-token" | "anonymous";
};

export type RequestContextOptions = {
  generateRequestId?: () => string;
  now?: () => number;
};

const SAFE_REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function createRequestContext(
  request: Request,
  options: RequestContextOptions = {},
): RequestContext {
  return {
    requestId: requestId(request, options.generateRequestId),
    receivedAt: (options.now ?? Date.now)(),
    abortSignal: request.signal,
    rawHost: nonEmpty(request.headers.get("host")),
    forwardedHost: firstHop(request.headers.get("x-forwarded-host")),
    forwardedProto: firstHop(request.headers.get("x-forwarded-proto")),
    publicOrigin: resolvePortalOrigin(request),
    principal: null,
    authSource: "anonymous",
  };
}

function requestId(request: Request, generateRequestId: () => string = randomUUID): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  if (supplied && SAFE_REQUEST_ID.test(supplied)) return supplied;

  const generated = generateRequestId();
  return SAFE_REQUEST_ID.test(generated) ? generated : randomUUID();
}

function firstHop(value: string | null): string | undefined {
  return nonEmpty(value?.split(",", 1)[0] ?? null);
}

function nonEmpty(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
