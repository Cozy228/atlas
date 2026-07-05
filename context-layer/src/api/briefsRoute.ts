/**
 * The brief route family (Step 4, mid-level §3, I3) — governed + scoped, on the
 * one governed router. `GET /api/briefs/{moment}?service=…&app=…` (fallback
 * `&lz=`) resolves the situation from `ctx.scope` and assembles the one `Brief`
 * value (template → executor); `?since=` narrows the change moment; `?depth=`
 * selects citations vs excerpts (M9). `/briefs/{moment}.md` renders the SAME
 * `Brief` value as Markdown (a stable address, ≠ a stored file; stamped
 * `resolvedAt`), the same seam as `/resources/{…}.md`.
 *
 * `debug` is a documented not-yet-available honest response (Step 7, M7): never a
 * fabricated block (D11).
 *
 * Batch-0: signatures only (throw `unimplemented`). Batch 5 wires the endpoints,
 * `.md`, `depth`, client threading, and the `debug` honest-empty response.
 */
import type { ApiErrorResponse, Brief, BriefDepth } from "@atlas/schema";
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import { unimplemented } from "../briefs/unimplemented";
import type { ApiResponse } from "./routeTypes";

export type BriefRequestOptions = {
  /** The target service slug for adopt/build (`?service=`). */
  service?: string;
  /** Incremental cursor for the change moment (`?since=`). */
  since?: string;
  /** Citations vs excerpts (M9/P28); defaults to `citations` for MCP-shaped
   *  callers per mid-level §3, `excerpts` for human renders. */
  depth?: BriefDepth;
};

export async function handleBriefRequest(
  _moment: string,
  _ctx: GovernedResolutionContext,
  _options: BriefRequestOptions = {},
): Promise<ApiResponse<ApiErrorResponse | Brief>> {
  return unimplemented("handleBriefRequest");
}

/** Render one `Brief` value as Markdown for `/briefs/{moment}.md` (I3: the same
 *  value the JSON + Portal faces consume; face drift is unwritable). */
export function renderBriefMarkdown(_brief: Brief): string {
  return unimplemented("renderBriefMarkdown");
}
