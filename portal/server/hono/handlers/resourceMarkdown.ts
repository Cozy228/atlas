import type { ResourceContextResponse } from "@atlas/schema";
import { handleResourceContextRequest, renderResourceMarkdown } from "@atlas/context-layer";

import { resolvePortalOrigin } from "@/api/server/portalOrigin";

/**
 * Agent-facing Markdown projection for `/resources/{kind}/{slug}[.md]`.
 * The content is rendered per request from the same Context Layer facade as the JSON API.
 */
export async function handleResourceMarkdown(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/resources\/([^/]+)\/(.+)$/);
  if (!match) return new Response("Not found", { status: 404 });

  const slug = match[2].endsWith(".md") ? match[2].slice(0, -3) : match[2];
  const result = await handleResourceContextRequest({
    kind: decodeURIComponent(match[1]),
    slug: decodeURIComponent(slug),
    sections: url.searchParams.get("sections") ?? undefined,
    baseUrl: resolvePortalOrigin(request),
  });

  if (result.status !== 200) {
    return Response.json(result.body, { status: result.status });
  }

  return new Response(renderResourceMarkdown(result.body as ResourceContextResponse), {
    status: 200,
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
