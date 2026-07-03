/**
 * What's New feed — one live resolve of the federated-platform "What's New"
 * Confluence page, projected to BOTH formal releases and standalone
 * announcements.
 *
 * Single server fn / single query key on purpose: the two projections come off
 * ONE page render (`resolveReleaseNotes` does one fetch + one render + both
 * parses). Splitting them across two server fns / two query keys made Home and
 * /whatsnew each re-resolve the page — the fetch was cache-deduped but the
 * render+parse and a whole server round-trip were repeated. With one key, Home
 * warms the cache and /whatsnew reads it synchronously — no second resolve.
 *
 * Not configured / restricted / unavailable resolves to honest empty lists —
 * never a fake fallback — and the UI degrades gracefully.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  cachedResolutionContext,
  resolveReleaseNotes,
  type Announcement,
  type Release,
} from "@atlas/context-layer";

export type { Announcement, Release } from "@atlas/context-layer";

export type WhatsNewFeed = { releases: Release[]; announcements: Announcement[] };

export const fetchWhatsNew = createServerFn({
  method: "GET",
  strict: { output: false },
}).handler(async (): Promise<WhatsNewFeed> => {
  const result = await resolveReleaseNotes(await cachedResolutionContext());
  return result.ok
    ? { releases: result.releases, announcements: result.announcements }
    : { releases: [], announcements: [] };
});
