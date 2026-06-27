/**
 * Newsletter announcements projection for What's New / Home.
 *
 * Server-only: reads the standalone announcements from the same newsletter
 * manifest as the releases, through the Context Layer loader — one source, two
 * entry kinds (releases + announcements).
 */
import { createServerFn } from "@tanstack/react-start";
import { loadAnnouncements, type Announcement } from "@atlas/context-layer";

export type { Announcement } from "@atlas/context-layer";

export const fetchAnnouncements = createServerFn({
  method: "GET",
  strict: { output: false },
}).handler(async (): Promise<Announcement[]> => loadAnnouncements());
