import type { Source } from "@atlas/schema";

import type { ResolutionContext } from "./resolverTypes";

/**
 * The app-scope authorization gate (WS4, F3-2/F3-3; ADR-0012 decision 3). This is the FIRST
 * and ONLY authorization filter in the Context Layer — this slice INTRODUCES it (there was
 * no prior authz function to flip). It is seated at every site that reads a `Source` off the
 * `SourceRepository` port, BEFORE source-content resolution, so a `visibility: "app"` Source
 * reaches ONLY a caller whose VERIFIED APP set (axis 2, `ctx.verifiedApps`) contains its
 * `app_id`. Non-app Sources (`internal` | `restricted`) are always visible — open-discovery
 * (ADR-0012); `restricted` keeps its warning-only semantic and is never gated here.
 *
 * FAIL-CLOSED, ALWAYS (E5/R5): visibility is denied unless membership is affirmatively
 * proven. An `app`-visibility Source with no `app_id` is unrepresentable (schema refine), but
 * were one to exist it is still denied. Identity unconfigured / unverified ⇒ empty verified
 * set ⇒ every `app` Source is invisible everywhere. No env flag can turn the gate off.
 *
 * REVOCATION STALENESS BOUND (F3-3, part of this gate's DoD proof): the verified set is a
 * snapshot of the caller's membership at the moment their identity was resolved (BFF session
 * claims, or a machine-surface token). A user REMOVED from an APP in Entra retains access to
 * that APP's `app` Sources until their session/token is refreshed — the gate is only as fresh
 * as `ctx.verifiedApps`. It bounds exposure to at most one token/session lifetime; it does not
 * revoke mid-session. This is asserted by `appScopeGate.test.ts` ("revocation staleness bound").
 */

/** The vetted app-id set for this request (identity-light). Absent ⇒ empty ⇒ fail-closed. */
export function verifiedAppsOf(ctx: Pick<ResolutionContext, "verifiedApps">): ReadonlySet<string> {
  return new Set(ctx.verifiedApps ?? []);
}

/**
 * Is this Source visible to the caller? True for every non-`app` Source; for an `app` Source,
 * true IFF its `app_id` is in the verified set. Fail-closed on a missing `app_id`.
 */
export function isSourceVisible(source: Source, verified: ReadonlySet<string>): boolean {
  if (source.visibility !== "app") {
    return true;
  }
  return source.app_id !== undefined && verified.has(source.app_id);
}

/**
 * Gate a single Source lookup: returns the Source when visible, otherwise `undefined` —
 * indistinguishable from a non-existent Source, so an unverified caller cannot observe an
 * `app` Source's existence in any form (no listing, content, count, or warning).
 */
export function gateSource(
  source: Source | undefined,
  ctx: Pick<ResolutionContext, "verifiedApps">,
): Source | undefined {
  if (!source) {
    return undefined;
  }
  return isSourceVisible(source, verifiedAppsOf(ctx)) ? source : undefined;
}

/** Gate a Source listing: drops every Source the caller may not see. */
export function gateSources(
  sources: Source[],
  ctx: Pick<ResolutionContext, "verifiedApps">,
): Source[] {
  const verified = verifiedAppsOf(ctx);
  return sources.filter((source) => isSourceVisible(source, verified));
}
