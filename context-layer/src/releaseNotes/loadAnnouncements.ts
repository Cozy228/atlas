import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

import { RELEASE_NOTES_DATA_DIR } from "./loadReleaseNotes";

/**
 * Standalone newsletter announcements.
 *
 * The newsletter is one source with two entry kinds: formal **releases**
 * ({@link Release}, the change log) and standalone **announcements** — editorial
 * notes (new service, policy change, resolved incident…) that don't belong to a
 * release. Both live in `data/newsletter.yaml` so there is a single source of
 * truth; this loader reads the `announcements:` section.
 */
export type Announcement = {
  /** Stable id used as a render key. */
  id: string;
  /** Posted date as ISO `YYYY-MM-DD` (optionally with a time, for same-day order). */
  postedAt?: string;
  /** Month bucket label, e.g. "June 2026", derived from postedAt. */
  month?: string;
  /** Free-form kind label, e.g. New / Updated / Policy / Deprecated / Incident. */
  kind?: string;
  title: string;
  summary?: string;
  /** Optional call-to-action; `href` may be an internal path or external URL. */
  link?: { label: string; href: string };
};

type RawAnnouncement = {
  id?: unknown;
  posted_at?: unknown;
  kind?: unknown;
  title?: unknown;
  summary?: unknown;
  link?: { label?: unknown; href?: unknown };
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function loadAnnouncements(dir: string = RELEASE_NOTES_DATA_DIR): Announcement[] {
  const parsed = parse(readFileSync(join(dir, "newsletter.yaml"), "utf8")) as {
    announcements?: RawAnnouncement[];
  };
  return (parsed.announcements ?? []).map(toAnnouncement);
}

function toAnnouncement(raw: RawAnnouncement, index: number): Announcement {
  const postedAt = str(raw.posted_at);
  const link =
    raw.link && str(raw.link.label) && str(raw.link.href)
      ? { label: str(raw.link.label)!, href: str(raw.link.href)! }
      : undefined;
  return {
    id: str(raw.id) ?? `announcement-${index + 1}`,
    postedAt,
    month: monthLabel(postedAt),
    kind: str(raw.kind),
    title: str(raw.title) ?? "",
    summary: str(raw.summary),
    link,
  };
}

function monthLabel(iso: string | undefined): string | undefined {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return undefined;
  const name = MONTH_NAMES[Number(match[2]) - 1];
  return name ? `${name} ${match[1]}` : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
