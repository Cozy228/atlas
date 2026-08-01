import type { RequestContext } from "./requestContext";

export type RequestLogEvent = {
  event: "request";
  requestId: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
  aborted: boolean;
};

export function createRequestLogEvent(input: {
  requestContext: RequestContext;
  method: string;
  path: string;
  status: number;
  completedAt: number;
}): RequestLogEvent {
  return {
    event: "request",
    requestId: input.requestContext.requestId,
    method: input.method,
    path: normalizePath(input.path),
    status: input.status,
    latencyMs: Math.max(0, input.completedAt - input.requestContext.receivedAt),
    aborted: input.requestContext.abortSignal.aborted,
  };
}

function normalizePath(path: string): string {
  const pathname = path.split("?", 1)[0] || "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}
