/**
 * Newsletter announcements projection for What's New / Home.
 *
 * Server-only, single live path: the standalone announcements come off the same
 * federated-platform "What's New" Confluence page as the releases (one source,
 * two entry kinds), extracted by `resolveReleaseNotes`. Not configured / restricted
 * / unavailable resolves to an honest empty list — never a fake fallback.
 */
import { createServerFn } from "@tanstack/react-start";
import {
  cachedResolutionContext,
  resolveReleaseNotes,
  type Announcement,
} from "@atlas/context-layer";

export type { Announcement } from "@atlas/context-layer";

export const fetchAnnouncements = createServerFn({
  method: "GET",
  strict: { output: false },
}).handler(async (): Promise<Announcement[]> => {
  const result = await resolveReleaseNotes(await cachedResolutionContext());
  return result.ok ? result.announcements : [];
});
