/**
 * Agent-facing Markdown representation of a resource (proposal §5.4 / §11):
 * `GET /resources/{kind}/{slug}.md`. A live projection rendered per request from
 * the same facade the JSON API uses — no stored file. The `.md` suffix is
 * optional so `/resources/{kind}/{slug}` is readable too.
 */
import type { ResourceContextResponse } from "@atlas/schema";
import { handleResourceContextRequest, renderResourceMarkdown } from "@atlas/context-layer";
import { handlerRequest, resolvePortalOrigin } from "@/api/server/portalOrigin";

export default async (event: unknown): Promise<Response> => {
  const request = handlerRequest(event);
  const origin = resolvePortalOrigin(request);
  const url = request ? new URL(request.url) : undefined;
  const path = url?.pathname ?? "";

  const match = path.match(/^\/resources\/([^/]+)\/(.+?)(?:\.md)?$/);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }

  const result = await handleResourceContextRequest({
    kind: decodeURIComponent(match[1]),
    slug: decodeURIComponent(match[2]),
    sections: url?.searchParams.get("sections") ?? undefined,
    baseUrl: origin,
  });

  if (result.status !== 200) {
    return Response.json(result.body, { status: result.status });
  }

  return new Response(renderResourceMarkdown(result.body as ResourceContextResponse), {
    status: 200,
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
};
