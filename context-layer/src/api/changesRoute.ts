/**
 * The change-feed route (Step 2, M8) — governed + scoped, on the one governed
 * router. `GET /api/changes?since=<cursor>` returns `{ events, cursor }` filtered
 * to `ctx.scope` (a service / available-in event is in scope iff its subject's
 * LZ set intersects `scope.landingZoneIds`; an unscoped ctx ⇒ all events). The
 * Atom rendering serves the same scoped payload as `application/atom+xml` — zero
 * new infrastructure, agent-consumable (both push cells of M8's matrix).
 *
 * What's New is a SEPARATE editorial Confluence projection (P31) — this route
 * and its module import no release-notes symbol, and vice versa.
 */
import type { ApiErrorResponse, ChangeEvent, ChangesResponse } from "@atlas/schema";
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";
import { eventCursor } from "../repositories/eventsRepository";
import type { ApiResponse } from "./routeTypes";

export type ChangesRequestOptions = {
  /** Opaque incremental cursor (`eventCursor`), from a prior response. */
  since?: string;
};

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}

export async function handleChangesRequest(
  ctx: GovernedResolutionContext,
  options: ChangesRequestOptions = {},
): Promise<ApiResponse<ApiErrorResponse | ChangesResponse>> {
  const repository = sharedEventsRepository(readProcessEnv());
  const feed = await repository.listSince(options.since);

  // Scope filter (M8/decision 6): an event is in scope iff its subject's LZ set
  // intersects the ctx's scope; an unscoped ctx sees everything.
  const scopeIds = ctx.scope?.landingZoneIds;
  const events =
    scopeIds && scopeIds.length > 0
      ? feed.filter((event) => event.landingZoneIds.some((id) => scopeIds.includes(id)))
      : feed;

  const cursor = events.length > 0 ? eventCursor(events[events.length - 1]) : null;
  return { status: 200, body: { events, cursor } };
}

export type ChangesAtomOptions = {
  /** Absolute self URL for the feed (the `?scope`/`?since` query, echoed back). */
  selfUrl?: string;
  /** Human scope label for the feed title (e.g. the APP name or the LZ set). */
  scopeLabel?: string;
};

/** Render a scoped `ChangesResponse` as an Atom 1.0 feed document. */
export function renderChangesAtom(
  response: ChangesResponse,
  options: ChangesAtomOptions = {},
): string {
  const title = options.scopeLabel ? `Atlas changes — ${options.scopeLabel}` : "Atlas changes";
  const updated = response.events.at(-1)?.derivedAt ?? "1970-01-01T00:00:00.000Z";
  const selfLink = options.selfUrl ? `\n  <link rel="self" href="${xml(options.selfUrl)}"/>` : "";

  const entries = response.events.map((event) => renderEntry(event)).join("\n");
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <title>${xml(title)}</title>`,
    `  <id>urn:atlas:changes:${xml(options.scopeLabel ?? "all")}</id>`,
    `  <updated>${xml(updated)}</updated>${selfLink}`,
    entries,
    "</feed>",
    "",
  ].join("\n");
}

function renderEntry(event: ChangeEvent): string {
  const target = event.object ? `${event.subject.id} → ${event.object.id}` : event.subject.id;
  const version = event.from && event.to ? ` (${event.from} → ${event.to})` : "";
  const title = `${event.class}: ${target}${version}`;
  return [
    "  <entry>",
    `    <id>urn:atlas:change:${xml(event.id)}</id>`,
    `    <title>${xml(title)}</title>`,
    `    <updated>${xml(event.derivedAt)}</updated>`,
    `    <category term="${xml(event.class)}"/>`,
    // Provenance: the source root the delta was witnessed on (each entry is cited).
    `    <summary>Derived from root '${xml(event.rootId)}'.</summary>`,
    "  </entry>",
  ].join("\n");
}

function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
