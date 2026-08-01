import { Hono, type Context } from "hono";
import { accepts } from "hono/accepts";

import { buildHomeLinkHeader } from "@/api/server/agentDiscovery";
import { bridgeContextApiRequest } from "@/api/server/contextApiBridge";
import { handleMcpRequest } from "@/api/server/mcp/handler";
import { resolvePortalOrigin } from "@/api/server/portalOrigin";
import aiCatalogHandler from "../routes/.well-known/ai-catalog.json";
import apiCatalogHandler from "../routes/.well-known/api-catalog";
import mcpServerCardHandler from "../routes/.well-known/mcp/server-card.json";
import oauthProtectedResourceHandler from "../routes/.well-known/oauth-protected-resource";
import internalOpenApiHandler from "../routes/api/internal/openapi.json";
import healthHandler from "../routes/health";
import llmsTxtHandler from "../routes/llms.txt";
import openApiHandler from "../routes/openapi.json";
import resourceMarkdownHandler from "../routes/resources/[...]";
import robotsTxtHandler from "../routes/robots.txt";
import sitemapHandler from "../routes/sitemap.xml";

const SERVER_PATH_PREFIXES = ["/api", "/health", "/mcp", "/.well-known", "/resources"];
const STATIC_FILE_EXTENSION =
  /\.(?:avif|br|css|gif|gz|html?|ico|jpe?g|js|json|map|md|mjs|otf|png|svg|ttf|txt|webmanifest|webp|woff2?|xml)$/i;

export type PortalAppOptions = {
  renderSpaDocument?: (request: Request) => Response | Promise<Response>;
};

export function createPortalApp(options: PortalAppOptions = {}): Hono {
  const app = new Hono();

  app.use("*", async (context, next) => {
    await next();
    if (context.req.path === "/") {
      context.header("Link", buildHomeLinkHeader(resolvePortalOrigin(context.req.raw)));
    }
  });

  app.all("/health", () => healthHandler());
  app.all("/api/internal/openapi.json", (context) => internalOpenApiHandler(context.req.raw));
  app.all("/api", (context) => bridgeContextApiRequest(context.req.raw));
  app.all("/api/*", (context) => bridgeContextApiRequest(context.req.raw));
  app.all("/.well-known/ai-catalog.json", (context) => aiCatalogHandler(context.req.raw));
  app.all("/.well-known/api-catalog", (context) => apiCatalogHandler(context.req.raw));
  app.all("/.well-known/mcp/server-card.json", (context) => mcpServerCardHandler(context.req.raw));
  app.all("/.well-known/oauth-protected-resource", (context) =>
    oauthProtectedResourceHandler(context.req.raw),
  );
  app.all("/llms.txt", (context) => llmsTxtHandler(context.req.raw));
  app.all("/openapi.json", (context) => openApiHandler(context.req.raw));
  app.all("/robots.txt", (context) => robotsTxtHandler(context.req.raw));
  app.all("/sitemap.xml", (context) => sitemapHandler(context.req.raw));
  app.all("/mcp", (context) => handleMcpRequest(context.req.raw));
  app.all("/resources", (context) => resourceMarkdownHandler(context.req.raw));
  app.all("/resources/*", (context) => resourceMarkdownHandler(context.req.raw));
  app.notFound(async (context) => {
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

function acceptsHtml(context: Context): boolean {
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
