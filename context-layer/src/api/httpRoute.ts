import type { ApiErrorResponse, ContextRequest } from "@atlas/schema";
import { handleContextRequest } from "./contextRoute.js";
import { handleFeedbackRequest } from "./feedbackRoute.js";
import { handleSourceDiscoveryRequest } from "./sourceDiscoveryRoute.js";
import { handleTopicDiscoveryRequest } from "./topicDiscoveryRoute.js";

export type HttpRequest = {
  method: string;
  path: string;
  query?: Record<string, string | undefined>;
  body?: string;
};

export type HttpResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

type RouteResult = {
  status: number;
  body: unknown;
};

export async function handleHttpRequest(request: HttpRequest): Promise<HttpResponse> {
  const method = request.method.toUpperCase();
  const path = normalizePath(request.path);

  if (method === "GET" && path === "/topics") {
    return jsonResponse(handleTopicDiscoveryRequest(compactQuery(request.query)));
  }

  const topicContextMatch = path.match(/^\/topics\/([^/]+)\/context$/);
  if (method === "GET" && topicContextMatch) {
    return jsonResponse(
      handleContextRequest({
        topic_id: decodeURIComponent(topicContextMatch[1]),
        ...contextQuery(request.query),
      }),
    );
  }

  if (method === "GET" && path === "/sources") {
    return jsonResponse(handleSourceDiscoveryRequest(compactQuery(request.query)));
  }

  const sourceContentMatch = path.match(/^\/sources\/([^/]+)\/content$/);
  if (method === "GET" && sourceContentMatch) {
    return jsonResponse(
      handleContextRequest({
        source_id: decodeURIComponent(sourceContentMatch[1]),
        ...contextQuery(request.query),
      }),
    );
  }

  if (method === "POST" && path === "/context-bundle") {
    return jsonResponse(handleContextRequest(parseJsonBody(request.body)));
  }

  if (method === "POST" && path === "/feedback") {
    return jsonResponse(await handleFeedbackRequest(parseJsonBody(request.body)));
  }

  return jsonResponse({
    status: 404,
    body: {
      error: {
        code: "invalid_request",
        message: "Route was not found.",
      },
    } satisfies ApiErrorResponse,
  });
}

function normalizePath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const withoutTrailingSlash = normalized.length > 1 && normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
  return withoutTrailingSlash.startsWith("/api/")
    ? withoutTrailingSlash.slice(4)
    : withoutTrailingSlash;
}

function compactQuery(query: HttpRequest["query"] = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

function contextQuery(query: HttpRequest["query"] = {}): Partial<ContextRequest> {
  const compacted = compactQuery(query);
  return {
    anchor_id: compacted.anchor_id,
    disclosure_level: compacted.disclosure_level
      ? Number(compacted.disclosure_level)
      : undefined,
  };
}

function parseJsonBody(body: string | undefined): unknown {
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    return {};
  }
}

function jsonResponse(result: RouteResult): HttpResponse {
  return {
    status: result.status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(result.body),
  };
}
