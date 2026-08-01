import { Hono, type Context } from "hono";
import { accepts } from "hono/accepts";

import { bridgeContextApiRequest } from "@/api/server/contextApiBridge";

const SERVER_PATH_PREFIXES = ["/api", "/health", "/mcp", "/.well-known", "/resources"];
const STATIC_FILE_EXTENSION =
  /\.(?:avif|br|css|gif|gz|html?|ico|jpe?g|js|json|map|md|mjs|otf|png|svg|ttf|txt|webmanifest|webp|woff2?|xml)$/i;

export type PortalAppOptions = {
  renderSpaDocument?: (request: Request) => Response | Promise<Response>;
};

export function createPortalApp(options: PortalAppOptions = {}): Hono {
  const app = new Hono();

  app.get("/health", (context) => context.json({ status: "ok" }));
  app.all("/api/*", (context) => bridgeContextApiRequest(context.req.raw));
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
