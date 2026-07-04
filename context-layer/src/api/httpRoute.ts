import type { ApiErrorResponse, ResourceContextResponse } from "@atlas/schema";
import { handleAvailabilityRequest } from "./availabilityRoute";
import { handleFeedbackRequest } from "./feedbackRoute";
import {
  handleResourceCatalogRequest,
  handleResourceContextRequest,
  handleResourceRecordRequest,
  handleResourceSearchRequest,
} from "./resourceRoutes";
import { handleSourceDiscoveryRequest } from "./sourceDiscoveryRoute";
import { handleSourceRequest } from "./sourceRoute";
import { renderResourceMarkdown } from "../resources/renderResourceMarkdown";
import {
  createResolutionContext,
  type GovernedResolutionContext,
  type ScopeInput,
} from "../resolvers/createResolutionContext";

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
  const ctx = await resolutionContextFromRequest(request);

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

  if (method === "GET" && path === "/resources/catalog") {
    return jsonResponse(await handleResourceCatalogRequest());
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
 * Delegate to the one governance-gate factory (Step 1): the opaque caller Bearer
 * from `Authorization` (threaded unparsed — Confluence enforces ACL against
 * whatever identity it represents) plus any scope declared on the query (locked
 * decision 7). The factory wires the shared cached fetch and vets the scope.
 */
async function resolutionContextFromRequest(
  request: HttpRequest,
): Promise<GovernedResolutionContext> {
  return createResolutionContext({
    identity: { bearer: bearerToken(request.headers) },
    scope: scopeFromQuery(request.query),
  });
}

/**
 * Read a scope declaration off the query (locked decision 7). `landingZones`
 * (comma-separated) declares scope by value; `appId` declares it by reference;
 * both together are reconciled by the factory (value wins, `scope_drift` on
 * disagreement). Absent ⇒ an anonymous unscoped context.
 */
function scopeFromQuery(query: HttpRequest["query"]): ScopeInput | undefined {
  const appId = query?.appId?.trim() || undefined;
  const landingZones = (query?.landingZones ?? "")
    .split(",")
    .map((zone) => zone.trim())
    .filter((zone) => zone.length > 0);
  const hasValue = landingZones.length > 0;

  if (hasValue && appId) {
    return { kind: "both", landingZones, appId };
  }
  if (hasValue) {
    return { kind: "by-value", landingZones };
  }
  if (appId) {
    return { kind: "by-reference", appId };
  }
  return undefined;
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
