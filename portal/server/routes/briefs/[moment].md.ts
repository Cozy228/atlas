/**
 * Public stable-address Markdown render of a moment Brief (Step 4, mid-level §3):
 * `GET /briefs/{moment}.md`. A live render per request from the SAME `Brief`
 * value the JSON API + Portal page consume (I3 — face drift is unwritable); a
 * stable address, NOT a stored file (`resolvedAt` is restamped every render). The
 * same seam as `/resources/{…}.md`; the context-layer router already serves the
 * `/api/briefs/{moment}.md` twin, this is the public alias.
 */
import type { Brief, BriefDepth } from "@atlas/schema";
import {
  API_DEFAULT_DEPTH,
  createResolutionContext,
  handleBriefRequest,
  instrumentsMetrics,
  renderBriefMarkdown,
  type ScopeInput,
} from "@atlas/context-layer";
import { handlerRequest } from "@/api/server/portalOrigin";

export default async (event: unknown): Promise<Response> => {
  const request = handlerRequest(event);
  const url = request ? new URL(request.url) : undefined;
  const path = url?.pathname ?? "";

  const match = path.match(/^\/briefs\/([^/]+?)(?:\.md)?$/);
  if (!match) {
    return new Response("Not found", { status: 404 });
  }
  const moment = decodeURIComponent(match[1]);
  const query = url?.searchParams;

  // Govern the render through the one factory (Step 1): the opaque caller Bearer
  // rides to the upstream fetch, the process-shared content cache is wired in, and
  // the scope is vetted — so a repeat render is a cache hit and face drift is
  // impossible (same handler as the JSON face).
  const ctx = await createResolutionContext({
    identity: { bearer: bearerFromRequest(request) },
    scope: scopeFromQuery(query),
  });
  const result = await handleBriefRequest(moment, ctx, {
    service: query?.get("service")?.trim() || undefined,
    since: query?.get("since")?.trim() || undefined,
    ...depthOption(query?.get("depth")),
  });

  if (result.status !== 200) {
    return Response.json(result.body, { status: result.status });
  }

  const brief = result.body as Brief;
  const markdown = renderBriefMarkdown(brief);
  // Markdown-face token cost (Step 6, locked decision 5): the public `.md` alias
  // renders on the `"http"` face, same as the context-layer twin — one observation
  // for the markdown payload it actually serves.
  instrumentsMetrics.recordBriefPayload({
    moment: brief.moment,
    depth: depthOption(query?.get("depth")).depth ?? API_DEFAULT_DEPTH,
    channel: "http",
    face: "markdown",
    serialize: () => markdown,
  });
  return new Response(markdown, {
    status: 200,
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
};

/** Read a scope declaration off the query (locked decision 7), same shape as the
 *  context-layer router: `landingZones` (by value) and/or `appId` (by reference). */
function scopeFromQuery(query: URLSearchParams | undefined): ScopeInput | undefined {
  const appId = query?.get("appId")?.trim() || undefined;
  const landingZones = (query?.get("landingZones") ?? "")
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

function depthOption(raw: string | null | undefined): { depth?: BriefDepth } {
  return raw === "citations" || raw === "excerpts" ? { depth: raw } : {};
}

/** Extract the opaque caller Bearer from a request's `Authorization` header. */
function bearerFromRequest(request: Request | undefined): string | undefined {
  const header = request?.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : undefined;
}
