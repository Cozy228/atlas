import { handleHttpRequest } from "../api/httpRoute.js";

type ApiGatewayHttpEvent = {
  version?: string;
  routeKey?: string;
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
  requestContext?: {
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
  const response = await handleHttpRequest({
    method: event.requestContext?.http?.method ?? "GET",
    path: event.rawPath ?? event.requestContext?.http?.path ?? "/",
    query: parseQueryString(event.rawQueryString ?? ""),
    body: decodeBody(event.body, event.isBase64Encoded),
  });

  return {
    statusCode: response.status,
    headers: response.headers,
    body: response.body,
  };
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
