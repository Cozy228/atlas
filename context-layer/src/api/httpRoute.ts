import type { ApiErrorResponse, ResourceContextResponse } from "@atlas/schema";
import { handleAvailabilityRequest } from "./availabilityRoute";
import { handleFeedbackRequest } from "./feedbackRoute";
import {
  handleResourceContextRequest,
  handleResourceRecordRequest,
  handleResourceSearchRequest,
} from "./resourceRoutes";
import { handleSourceDiscoveryRequest } from "./sourceDiscoveryRoute";
import { handleSourceRequest } from "./sourceRoute";
import { handleTopicDiscoveryRequest } from "./topicDiscoveryRoute";
import { handleTopicRequest } from "./topicRoute";
import { renderResourceMarkdown } from "../resources/renderResourceMarkdown";
import type { ResolutionContext } from "../resolvers/resolverTypes";
import { cachedResolutionContext } from "../sourceContent/sourceContentCache";

export type HttpRequest = {
  method: string;
  path: string;
  query?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
  body?: string;
  /** Request origin (e.g. https://portal.example.com), used to build absolute
   * resource URLs in responses. Set by the Portal bridge; absent in-process. */
  origin?: string;
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
  const ctx = await resolutionContextFromHeaders(request.headers);

  if (method === "GET" && path === "/topics") {
    return jsonResponse(await handleTopicDiscoveryRequest(compactQuery(request.query)));
  }

  const topicIdMatch = path.match(/^\/topics\/([^/]+)$/);
  if (method === "GET" && topicIdMatch) {
    return jsonResponse(await handleTopicRequest(decodeURIComponent(topicIdMatch[1])));
  }

  if (method === "GET" && path === "/sources") {
    return jsonResponse(await handleSourceDiscoveryRequest(compactQuery(request.query)));
  }

  const sourceIdMatch = path.match(/^\/sources\/([^/]+)$/);
  if (method === "GET" && sourceIdMatch) {
    return jsonResponse(await handleSourceRequest(decodeURIComponent(sourceIdMatch[1])));
  }

  if (method === "GET" && path === "/availability") {
    return jsonResponse(await handleAvailabilityRequest());
  }

  if (method === "GET" && path === "/resources") {
    return jsonResponse(
      await handleResourceSearchRequest(request.query?.query, { baseUrl: request.origin }),
    );
  }

  // Presentation-metadata read (plan 020 15d) — matched BEFORE the context route
  // (whose `(.+)` slug would otherwise swallow the `/record` suffix).
  const resourceRecordMatch = path.match(/^\/resources\/([^/]+)\/(.+)\/record$/);
  if (method === "GET" && resourceRecordMatch) {
    return jsonResponse(
      await handleResourceRecordRequest({
        kind: decodeURIComponent(resourceRecordMatch[1]),
        slug: decodeURIComponent(resourceRecordMatch[2]),
      }),
    );
  }

  const resourceContextMatch = path.match(/^\/resources\/([^/]+)\/(.+)$/);
  if (method === "GET" && resourceContextMatch) {
    const result = await handleResourceContextRequest(
      {
        kind: decodeURIComponent(resourceContextMatch[1]),
        slug: decodeURIComponent(resourceContextMatch[2]),
        sections: request.query?.sections,
        baseUrl: request.origin,
      },
      ctx,
    );
    if (result.status === 200 && prefersMarkdown(request.headers)) {
      return markdownResponse(renderResourceMarkdown(result.body as ResourceContextResponse));
    }
    return jsonResponse(result);
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
 * request-scoped resolution context over the shared cached fetch. The token is
 * threaded unparsed and unpersisted; Confluence enforces ACL against whatever
 * identity it represents.
 */
async function resolutionContextFromHeaders(
  headers: HttpRequest["headers"],
): Promise<ResolutionContext> {
  const base = await cachedResolutionContext();
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
  const withoutTrailingSlash =
    normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  return withoutTrailingSlash.startsWith("/api/")
    ? withoutTrailingSlash.slice(4)
    : withoutTrailingSlash;
}

function compactQuery(query: HttpRequest["query"] = {}): Record<string, string> {
  return Object.fromEntries(
    Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
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

function markdownResponse(body: string): HttpResponse {
  return {
    status: 200,
    headers: { "content-type": "text/markdown; charset=utf-8" },
    body,
  };
}

/** True when the caller's `Accept` header prefers Markdown over JSON (§5.4). */
function prefersMarkdown(headers: HttpRequest["headers"]): boolean {
  if (!headers) {
    return false;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "accept" && value) {
      return /text\/markdown/i.test(value);
    }
  }
  return false;
}
