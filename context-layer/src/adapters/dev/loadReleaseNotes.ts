import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { resolveDataDir } from "./dataDir";
import type { Release, ReleaseItem, ReleaseResource } from "../../releaseNotes/parseReleaseNotes";

/**
 * Load the releases from the newsletter manifest (`data/newsletter.yaml`) into
 * {@link Release}s — the offline source the What's New surface renders. The live
 * `resolveReleaseNotes` path produces the same shape; this is the manifest the
 * parse outputs are written into.
 */

// Same Git-managed data dir as the registry — see resolveDataDir.
export const RELEASE_NOTES_DATA_DIR = resolveDataDir();

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
  // Honest-gap: no newsletter manifest present → no releases, rather than a crash.
  if (!existsSync(join(dir, "newsletter.yaml"))) {
    return [];
  }
  const parsed = parse(readFileSync(join(dir, "newsletter.yaml"), "utf8")) as {
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
