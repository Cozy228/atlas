import type {
  ApiErrorResponse,
  Brief,
  BriefDepth,
  ChangesResponse,
  ResourceContextResponse,
} from "@atlas/schema";
import {
  handleAppRegistrationRequest,
  handleAppRequest,
  handleAppsListRequest,
  handleAppUpdateRequest,
} from "./appsRoutes";
import { handleAvailabilityRequest } from "./availabilityRoute";
import { handleBriefRequest, renderBriefMarkdown, type BriefRequestOptions } from "./briefsRoute";
import { handleChangesRequest, renderChangesAtom } from "./changesRoute";
import { handleFeedbackRequest } from "./feedbackRoute";
import {
  handleLocationDeleteRequest,
  handleLocationRegistrationRequest,
  handleLocationsListRequest,
} from "./locationsRoutes";
import {
  handleResourceCatalogRequest,
  handleResourceContextRequest,
  handleResourceRecordRequest,
  handleResourceSearchRequest,
} from "./resourceRoutes";
import { handleSourceDiscoveryRequest } from "./sourceDiscoveryRoute";
import { handleSourceRequest } from "./sourceRoute";
import { handleStatusRequest } from "./statusRoute";
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
    return jsonResponse(await handleAvailabilityRequest(ctx));
  }

  // Status board (Step 7, P24; locked decision 8): governed + scoped via `ctx`, a
  // scope reader like availability. Aggregation-at-read of the scope's registered
  // locations' live values — read-only, uncited (ADR-0003), never stored.
  if (method === "GET" && path === "/status") {
    return jsonResponse(await handleStatusRequest(ctx));
  }

  // Change feed (Step 2, M8): governed + scoped via `ctx`; `?since=<cursor>` for
  // incremental reads. The `.atom` alias renders the SAME scoped payload as an
  // Atom feed — a representation of `/changes`, not a distinct JSON operation
  // (so it stays off the OpenAPI JSON surface, like the `.md` markdown seam).
  if (method === "GET" && path.endsWith("/changes.atom")) {
    const result = await handleChangesRequest(ctx, { since: request.query?.since });
    if (result.status !== 200) {
      return jsonResponse(result);
    }
    return atomResponse(
      renderChangesAtom(result.body as ChangesResponse, { selfUrl: request.origin }),
    );
  }
  if (method === "GET" && path === "/changes") {
    return jsonResponse(await handleChangesRequest(ctx, { since: request.query?.since }));
  }

  // Moment briefs (Step 4, mid-level §3): governed + scoped via `ctx`. One
  // `/briefs/` branch serves both `/briefs/{moment}` (JSON) and the
  // `/briefs/{moment}.md` representation — the `.md` render is the SAME Brief
  // value as Markdown (a stable address ≠ a stored file; stamped `resolvedAt`),
  // the same seam as `/resources/{…}.md`. `?service`/`?since`/`?depth` ride the
  // query; `debug` is an honest not-yet-available response (Step 7). Matched via
  // `startsWith` (like `/changes.atom`) so this representation family stays off
  // the OpenAPI JSON surface.
  if (method === "GET" && path.startsWith("/briefs/")) {
    const wantsMarkdown = path.endsWith(".md");
    const moment = decodeURIComponent(
      wantsMarkdown ? path.slice("/briefs/".length, -".md".length) : path.slice("/briefs/".length),
    );
    const result = await handleBriefRequest(moment, ctx, briefOptions(request.query));
    if (wantsMarkdown && result.status === 200) {
      return markdownResponse(renderBriefMarkdown(result.body as Brief));
    }
    return jsonResponse(result);
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

  // Consumer state (Step 3, mid-level §3): the apps store's only writers.
  if (path === "/apps") {
    if (method === "GET") {
      return jsonResponse(await handleAppsListRequest());
    }
    if (method === "POST") {
      return jsonResponse(await handleAppRegistrationRequest(parseJsonBody(request.body)));
    }
  }

  // Self-service registration (Step 7, mid-level §3): the locations store's only
  // writers. Governed + scoped via `ctx` (the owning APP is `ctx.scope.appId`,
  // never the body). Same branch style as `/apps`; the status board (`/status`)
  // is wired in Batch 5.
  if (path === "/locations") {
    if (method === "GET") {
      return jsonResponse(await handleLocationsListRequest(ctx));
    }
    if (method === "POST") {
      return jsonResponse(
        await handleLocationRegistrationRequest(ctx, parseJsonBody(request.body)),
      );
    }
  }

  const locationIdMatch = path.match(/^\/locations\/([^/]+)$/);
  if (locationIdMatch && method === "DELETE") {
    return jsonResponse(
      await handleLocationDeleteRequest(ctx, decodeURIComponent(locationIdMatch[1])),
    );
  }

  const appIdMatch = path.match(/^\/apps\/([^/]+)$/);
  if (appIdMatch) {
    const appId = decodeURIComponent(appIdMatch[1]);
    if (method === "GET") {
      return jsonResponse(await handleAppRequest(appId));
    }
    if (method === "PATCH") {
      return jsonResponse(await handleAppUpdateRequest(appId, parseJsonBody(request.body)));
    }
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

/**
 * Read the brief query options (Step 4): the target `?service=`, the change
 * `?since=` cursor, and the `?depth=` tier (M9). `depth` is validated to the
 * closed `citations|excerpts` set; anything else (or absent) leaves it unset so
 * the handler applies its per-face default.
 */
function briefOptions(query: HttpRequest["query"]): BriefRequestOptions {
  const depthRaw = query?.depth;
  const depth: BriefDepth | undefined =
    depthRaw === "citations" || depthRaw === "excerpts" ? depthRaw : undefined;
  return {
    service: query?.service?.trim() || undefined,
    since: query?.since?.trim() || undefined,
    ...(depth ? { depth } : {}),
  };
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

function atomResponse(body: string): HttpResponse {
  return {
    status: 200,
    headers: { "content-type": "application/atom+xml; charset=utf-8" },
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
