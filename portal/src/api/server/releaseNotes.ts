/**
 * Release-notes projection for What's New.
 *
 * Server-only. Live Confluence drives releases when configured
 * (`ATLAS_RELEASE_NOTES_PAGE_ID` + the Confluence env); otherwise it falls back
 * to the offline newsletter fixture via the Context Layer loader. Both produce the
 * same `Release[]` shape. (Standalone announcements stay git-authored — see
 * `announcements.ts`.)
 */
import { createServerFn } from "@tanstack/react-start";
import {
  cachedResolutionContext,
  loadReleaseNotes,
  resolveReleaseNotes,
  type Release,
} from "@atlas/context-layer";

export type { Release } from "@atlas/context-layer";

export const fetchReleaseNotes = createServerFn({
  method: "GET",
  strict: { output: false },
}).handler(async (): Promise<Release[]> => {
  const result = await resolveReleaseNotes(await cachedResolutionContext());
  // not_configured / restricted_source / source_unavailable → offline fixture.
  return result.ok ? result.releases : loadReleaseNotes();
});
