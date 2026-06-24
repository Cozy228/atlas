/**
 * Release-notes projection for What's New.
 *
 * Server-only: reads the `data/release-notes.yaml` manifest through the Context
 * Layer loader. The same shape is produced at runtime by `resolveReleaseNotes`
 * (live Confluence) — swap the implementation here to serve live releases once
 * a page id is configured.
 */
import { createServerFn } from "@tanstack/react-start";
import { loadReleaseNotes, type Release } from "@atlas/context-layer";

export type { Release } from "@atlas/context-layer";

export const fetchReleaseNotes = createServerFn({
  method: "GET",
  strict: { output: false },
}).handler(async (): Promise<Release[]> => loadReleaseNotes());
