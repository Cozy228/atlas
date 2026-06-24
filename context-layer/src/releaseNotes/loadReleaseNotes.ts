import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";

import type { Release, ReleaseItem, ReleaseResource } from "./parseReleaseNotes.js";

/**
 * Load the authored release-notes manifest (`data/release-notes.yaml`) into
 * {@link Release}s — the offline source the What's New surface renders. The live
 * `resolveReleaseNotes` path produces the same shape; this is the manifest the
 * parse outputs are written into.
 */

const here = dirname(fileURLToPath(import.meta.url));
// src/releaseNotes -> src -> context-layer -> repo root -> data
export const RELEASE_NOTES_DATA_DIR = join(here, "..", "..", "..", "data");

type RawItem = {
  category?: unknown;
  title?: unknown;
  ticket?: unknown;
};

type RawResource = { label?: unknown; url?: unknown };

type RawRelease = {
  id?: unknown;
  month?: unknown;
  posted_at?: unknown;
  change_request?: unknown;
  link?: unknown;
  jira_base?: unknown;
  items?: unknown;
  resources?: unknown;
  support?: unknown;
};

export function loadReleaseNotes(dir: string = RELEASE_NOTES_DATA_DIR): Release[] {
  const parsed = parse(readFileSync(join(dir, "release-notes.yaml"), "utf8")) as {
    releases?: RawRelease[];
  };
  const releases = (parsed.releases ?? []).map(toRelease);
  // Newest first by posted date.
  return releases.sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
}

function toRelease(raw: RawRelease, index: number): Release {
  const items = Array.isArray(raw.items) ? raw.items.map(toItem) : [];
  const resources = Array.isArray(raw.resources)
    ? raw.resources.map(toResource).filter((r): r is ReleaseResource => r !== undefined)
    : undefined;
  return {
    id: str(raw.id) ?? str(raw.change_request) ?? `release-${index + 1}`,
    month: str(raw.month),
    changeRequest: str(raw.change_request),
    postedAt: str(raw.posted_at),
    link: str(raw.link),
    jiraBase: str(raw.jira_base),
    items,
    resources,
    support: str(raw.support),
  };
}

function toResource(raw: RawResource): ReleaseResource | undefined {
  const label = str(raw.label);
  return label ? { label, url: str(raw.url) } : undefined;
}

function toItem(raw: RawItem, index: number): ReleaseItem {
  return {
    category: str(raw.category) ?? "Other",
    index: index + 1,
    title: str(raw.title) ?? "",
    ticket: str(raw.ticket),
  };
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
