import { handleHttpRequest } from "../api/httpRoute";
import { logger, resolveRequestId, withHttpRequestLogging } from "@atlas/logging";

const log = logger("context-layer.http");

type ApiGatewayHttpEvent = {
  version?: string;
  routeKey?: string;
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: {
    requestId?: string;
    http?: {
      method?: string;
      path?: string;
    };
  };
};

type ApiGatewayHttpResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

export async function handler(event: ApiGatewayHttpEvent): Promise<ApiGatewayHttpResponse> {
  const requestId = resolveRequestId(event.headers, event.requestContext?.requestId);
  const method = event.requestContext?.http?.method ?? "GET";
  const path = event.rawPath ?? event.requestContext?.http?.path ?? "/";
  const route = routePattern(path);

  return withHttpRequestLogging(
    {
      log,
      requestId,
      method,
      route,
      statusCode: (response) => response.statusCode,
    },
    async () => {
      const response = await handleHttpRequest({
        method,
        path,
        query: parseQueryString(event.rawQueryString ?? ""),
        headers: event.headers,
        body: decodeBody(event.body, event.isBase64Encoded),
      });

      return {
        statusCode: response.status,
        headers: { ...response.headers, "x-request-id": requestId },
        body: response.body,
      };
    },
  );
}

function routePattern(path: string): string {
  if (/^\/(?:api\/)?sources\/[^/]+$/.test(path)) return "/sources/:sourceId";
  if (/^\/(?:api\/)?resources\/[^/]+\/.+\/record$/.test(path)) {
    return "/resources/:kind/:slug/record";
  }
  if (/^\/(?:api\/)?resources\/[^/]+\/.+$/.test(path)) return "/resources/:kind/:slug";
  return path.startsWith("/api/") ? path.slice(4) : path;
}

function parseQueryString(rawQueryString: string): Record<string, string> {
  if (!rawQueryString) {
    return {};
  }
  return Object.fromEntries(
    rawQueryString.split("&").map((entry) => {
      const [rawKey = "", rawValue = ""] = entry.split("=");
      return [decodeQueryPart(rawKey), decodeQueryPart(rawValue)];
    }),
  );
}

function decodeBody(body: string | null | undefined, isBase64Encoded: boolean | undefined): string {
  if (!body) {
    return "";
  }
  if (!isBase64Encoded) {
    return body;
  }

  const runtime = globalThis as typeof globalThis & {
    atob?: (encoded: string) => string;
    Buffer?: { from(value: string, encoding: "base64"): { toString(encoding: "utf8"): string } };
  };

  if (runtime.atob) {
    return runtime.atob(body);
  }
  if (runtime.Buffer) {
    return runtime.Buffer.from(body, "base64").toString("utf8");
  }
  throw new Error("Base64 body decoding is not available in this runtime.");
}

function decodeQueryPart(value: string): string {
  return decodeURIComponent(value.replace(/\+/g, " "));
}
