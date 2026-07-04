/**
 * Agent-facing Markdown representation of a resource (proposal §5.4 / §11):
 * `GET /resources/{kind}/{slug}.md`. A live projection rendered per request from
 * the same facade the JSON API uses — no stored file. The `.md` suffix is
 * optional so `/resources/{kind}/{slug}` is readable too.
 */
import type { ResourceContextResponse } from "@atlas/schema";
import {
  createResolutionContext,
  handleResourceContextRequest,
  renderResourceMarkdown,
} from "@atlas/context-layer";
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

  // Govern the render through the one factory (Step 1): the opaque caller Bearer
  // rides to the upstream source fetch, and the process-shared content cache is
  // wired in, so a repeat render is a cache hit.
  const ctx = await createResolutionContext({ identity: { bearer: bearerFromRequest(request) } });
  const result = await handleResourceContextRequest(
    {
      kind: decodeURIComponent(match[1]),
      slug: decodeURIComponent(match[2]),
      sections: url?.searchParams.get("sections") ?? undefined,
      baseUrl: origin,
    },
    ctx,
  );

  if (result.status !== 200) {
    return Response.json(result.body, { status: result.status });
  }

  return new Response(renderResourceMarkdown(result.body as ResourceContextResponse), {
    status: 200,
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
};

/** Extract the opaque caller Bearer from a request's `Authorization` header. */
function bearerFromRequest(request: Request | undefined): string | undefined {
  const header = request?.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}
