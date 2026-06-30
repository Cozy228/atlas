/**
 * Release-notes projection for What's New.
 *
 * Server-only, single live path: the federated-platform "What's New" Confluence
 * page (via `resolveReleaseNotes`) is the only source. Not configured / restricted
 * / unavailable resolves to an honest empty list — never a fake fallback — and the
 * UI degrades gracefully. (Standalone announcements come off the same page — see
 * `announcements.ts`.)
 */
import { createServerFn } from "@tanstack/react-start";
import { cachedResolutionContext, resolveReleaseNotes, type Release } from "@atlas/context-layer";

export type { Release } from "@atlas/context-layer";

export const fetchReleaseNotes = createServerFn({
  method: "GET",
  strict: { output: false },
}).handler(async (): Promise<Release[]> => {
  const result = await resolveReleaseNotes(await cachedResolutionContext());
  return result.ok ? result.releases : [];
});
