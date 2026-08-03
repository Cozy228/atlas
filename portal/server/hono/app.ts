import { Hono, type Context } from "hono";
import { accepts } from "hono/accepts";
import { atlasMcpHandler } from "@atlas/context-layer/mcp";
import { runWithLogContext } from "@atlas/logging";

import { buildHomeLinkHeader } from "@/api/server/agentDiscovery";
import { answerAskAtlas, parseAskAtlasRequest } from "@/api/server/ask";
import { bridgeContextApiRequest } from "@/api/server/contextApiBridge";
import { createServerContextApiClient } from "@/api/server/httpContextApiClient";
import {
  loadPortalAnnouncements,
  loadPortalAvailability,
  loadPortalLandingZones,
  loadPortalReleases,
  resolveDataMode,
} from "@/api/server/portalData";
import { loadGuidance } from "@/lib/loadGuidance";
import {
  handleAgentOpenApi,
  handleAiCatalog,
  handleApiCatalog,
  handleInternalOpenApi,
  handleLlmsTxt,
  handleMcpServerCard,
  handleOauthProtectedResource,
  handleRobotsTxt,
} from "./handlers/agentDiscovery";
import { handleHealth } from "./handlers/health";
import { handleResourceMarkdown } from "./handlers/resourceMarkdown";
import { handleSitemap } from "./handlers/sitemap";
import {
  createRequestContext,
  type RequestContext,
  type RequestContextOptions,
} from "./requestContext";
import { createRequestLogEvent, type RequestLogEvent } from "./requestLogging";
import { trackResponseCompletion } from "./responseCompletion";

const SERVER_PATH_PREFIXES = ["/api", "/health", "/mcp", "/.well-known", "/resources"];
const STATIC_FILE_EXTENSION =
  /\.(?:avif|br|css|gif|gz|html?|ico|jpe?g|js|json|map|md|mjs|otf|png|svg|ttf|txt|webmanifest|webp|woff2?|xml)$/i;

type PortalEnv = {
  Variables: {
    requestContext: RequestContext;
  };
};

export type PortalAppOptions = RequestContextOptions & {
  isReady?: () => boolean;
  onRequestStart?: (requestContext: RequestContext) => (() => void) | undefined;
  onRequestComplete?: (event: RequestLogEvent) => void;
  serveStaticAsset?: (request: Request) => Response | undefined | Promise<Response | undefined>;
  renderSpaDocument?: (request: Request) => Response | Promise<Response>;
};

export function createPortalApp(options: PortalAppOptions = {}): Hono<PortalEnv> {
  const app = new Hono<PortalEnv>();

  app.use("*", async (context, next) => {
    const requestContext = createRequestContext(context.req.raw, options);
    context.set("requestContext", requestContext);
    const finishRequest = options.onRequestStart?.(requestContext);
    let completed = false;
    const completeRequest = (status: number) => {
      if (completed) return;
      completed = true;
      try {
        options.onRequestComplete?.(
          createRequestLogEvent({
            requestContext,
            method: context.req.method,
            path: context.req.path,
            status,
            completedAt: (options.now ?? Date.now)(),
          }),
        );
      } finally {
        finishRequest?.();
      }
    };
    try {
      await runWithLogContext({ requestId: requestContext.requestId }, next);
      context.header("X-Request-Id", requestContext.requestId);
      if (context.req.path === "/") {
        context.header("Link", buildHomeLinkHeader(requestContext.publicOrigin));
      }
      const status = context.res.status;
      context.res = trackResponseCompletion(context.res, () =>
        runWithLogContext({ requestId: requestContext.requestId }, () => completeRequest(status)),
      );
    } catch (error) {
      completeRequest(500);
      throw error;
    }
  });

  app.all("/health", (context) =>
    options.isReady?.() === false ? context.json({ status: "draining" }, 503) : handleHealth(),
  );
  app.get("/api/portal/data-mode", (context) => context.json({ dataMode: resolveDataMode() }));
  app.get("/api/portal/landing-zones", (context) =>
    context.json({ landingZones: loadPortalLandingZones() }),
  );
  app.get("/api/portal/availability", async (context) => {
    const token = bearerToken(context.req.raw);
    return context.json(
      await loadPortalAvailability(createServerContextApiClient({ token }), {
        coalesce: !token,
        signal: context.req.raw.signal,
      }),
    );
  });
  app.get("/api/portal/guidance", async (context) =>
    context.json({ guidance: await loadGuidance() }),
  );
  app.get("/api/portal/announcements", async (context) =>
    context.json({ announcements: await loadPortalAnnouncements() }),
  );
  app.get("/api/portal/releases", async (context) =>
    context.json({ releases: await loadPortalReleases() }),
  );
  app.post("/api/portal/ask", async (context) => {
    let request;
    try {
      request = parseAskAtlasRequest(await context.req.json());
    } catch {
      return context.json(
        {
          error: {
            code: "invalid_request",
            message: "Ask Atlas requires a non-empty question.",
          },
        },
        400,
      );
    }
    return context.json(
      await answerAskAtlas({
        request,
        token: bearerToken(context.req.raw),
        signal: context.req.raw.signal,
      }),
    );
  });
  app.all("/api/internal/openapi.json", (context) => handleInternalOpenApi(context.req.raw));
  app.all("/api", (context) => bridgeContextApiRequest(context.req.raw));
  app.all("/api/*", (context) => bridgeContextApiRequest(context.req.raw));
  app.all("/.well-known/ai-catalog.json", (context) => handleAiCatalog(context.req.raw));
  app.all("/.well-known/api-catalog", (context) => handleApiCatalog(context.req.raw));
  app.all("/.well-known/mcp/server-card.json", (context) => handleMcpServerCard(context.req.raw));
  app.all("/.well-known/oauth-protected-resource", (context) =>
    handleOauthProtectedResource(context.req.raw),
  );
  app.all("/llms.txt", (context) => handleLlmsTxt(context.req.raw));
  app.all("/openapi.json", (context) => handleAgentOpenApi(context.req.raw));
  app.all("/robots.txt", (context) => handleRobotsTxt(context.req.raw));
  app.all("/sitemap.xml", (context) => handleSitemap(context.req.raw));
  app.all("/mcp", (context) => atlasMcpHandler.fetch(context.req.raw));
  app.all("/resources", (context) => handleResourceMarkdown(context.req.raw));
  app.all("/resources/*", (context) => handleResourceMarkdown(context.req.raw));
  app.notFound(async (context) => {
    const staticResponse = await options.serveStaticAsset?.(context.req.raw);
    if (staticResponse) return staticResponse;

    const isDocumentMethod = context.req.method === "GET" || context.req.method === "HEAD";
    const lastPathSegment = context.req.path.split("/").at(-1) ?? "";
    const isFileRequest =
      context.req.path.startsWith("/assets/") || STATIC_FILE_EXTENSION.test(lastPathSegment);
    const isServerPath = SERVER_PATH_PREFIXES.some(
      (prefix) => context.req.path === prefix || context.req.path.startsWith(`${prefix}/`),
    );
    if (
      !isDocumentMethod ||
      isFileRequest ||
      isServerPath ||
      !acceptsHtml(context) ||
      !options.renderSpaDocument
    ) {
      return context.text("404 Not Found", 404);
    }
    const response = await options.renderSpaDocument(context.req.raw);
    if (context.req.method === "HEAD") {
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    return response;
  });

  return app;
}

function acceptsHtml(context: Context<PortalEnv>): boolean {
  return (
    accepts(context, {
      header: "Accept",
      supports: ["text/html"],
      default: "",
      match: (ranges) => {
        for (const type of ["text/html", "text/*", "*/*"]) {
          const range = ranges.find((candidate) => candidate.type.toLowerCase() === type);
          if (range) return range.q > 0 ? "text/html" : "";
        }
        return "";
      },
    }) === "text/html"
  );
}

function bearerToken(request: Request): string | undefined {
  const match = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}
