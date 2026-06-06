import type { ApiErrorResponse, ContextRequest } from "@atlas/schema";
import { handleContextRequest } from "./contextRoute.js";
import { handleFeedbackRequest } from "./feedbackRoute.js";
import { handleSourceDiscoveryRequest } from "./sourceDiscoveryRoute.js";
import { handleSourceRequest } from "./sourceRoute.js";
import { handleTopicDiscoveryRequest } from "./topicDiscoveryRoute.js";
import { handleTopicRequest } from "./topicRoute.js";
import {
  offlineResolutionContext,
  type ResolutionContext,
} from "../resolvers/resolverTypes.js";

export type HttpRequest = {
  method: string;
  path: string;
  query?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
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
  const ctx = resolutionContextFromHeaders(request.headers);

  if (method === "GET" && path === "/topics") {
    return jsonResponse(handleTopicDiscoveryRequest(compactQuery(request.query)));
  }

  const topicIdMatch = path.match(/^\/topics\/([^/]+)$/);
  if (method === "GET" && topicIdMatch) {
    return jsonResponse(handleTopicRequest(decodeURIComponent(topicIdMatch[1])));
  }

  const topicContextMatch = path.match(/^\/topics\/([^/]+)\/context$/);
  if (method === "GET" && topicContextMatch) {
    return jsonResponse(
      await handleContextRequest(
        {
          topic_id: decodeURIComponent(topicContextMatch[1]),
          ...contextQuery(request.query),
        },
        ctx,
      ),
    );
  }

  if (method === "GET" && path === "/sources") {
    return jsonResponse(handleSourceDiscoveryRequest(compactQuery(request.query)));
  }

  const sourceIdMatch = path.match(/^\/sources\/([^/]+)$/);
  if (method === "GET" && sourceIdMatch) {
    return jsonResponse(handleSourceRequest(decodeURIComponent(sourceIdMatch[1])));
  }

  const sourceContentMatch = path.match(/^\/sources\/([^/]+)\/content$/);
  if (method === "GET" && sourceContentMatch) {
    return jsonResponse(
      await handleContextRequest(
        {
          source_id: decodeURIComponent(sourceContentMatch[1]),
          ...contextQuery(request.query),
        },
        ctx,
      ),
    );
  }

  if (method === "GET" && path === "/context") {
    return jsonResponse(await handleContextRequest(contextQuery(request.query), ctx));
  }

  if (method === "POST" && path === "/context-bundle") {
    return jsonResponse(await handleContextRequest(parseJsonBody(request.body), ctx));
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

/**
 * Read the opaque caller Bearer from the `Authorization` header and build the
 * request-scoped resolution context. The token is threaded unparsed and
 * unpersisted; Confluence enforces ACL against whatever identity it represents.
 */
function resolutionContextFromHeaders(
  headers: HttpRequest["headers"],
): ResolutionContext {
  const base = offlineResolutionContext();
  const token = bearerToken(headers);
  return token ? { ...base, token } : base;
}

function bearerToken(headers: HttpRequest["headers"]): string | undefined {
  if (!headers) {
    return undefined;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "authorization" && value) {
      const match = value.match(/^Bearer\s+(.+)$/i);
      if (match) {
        return match[1].trim();
      }
    }
  }
  return undefined;
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
    query: compacted.query,
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
