import { createHash } from "node:crypto";

import { monthLabel, parsePostedDate } from "./parseReleaseNotes";

/**
 * Parse the standalone **announcements** off the same federated-platform
 * "What's New" Confluence page as the releases.
 *
 * The page is one source with two entry kinds: formal releases (the change log,
 * {@link parseReleaseNotes}) and standalone announcements — editorial notes (new
 * service, policy change, resolved incident…) that don't belong to a release.
 * Both are rendered to text once by `renderStorageHtml`; this parser reads the
 * page's `Announcements` section, leaving the `Release Notes` sections to the
 * release parser.
 *
 * Expected section shape (the fixture mirrors a real page): an `Announcements`
 * heading, then one entry per `"<Kind> — <Title>"` heading, a summary paragraph,
 * a `"Posted on <day> <Month>, <year>"` line, and an optional call-to-action
 * rendered `"<label> (<href>)"` (`renderStorageHtml` preserves anchor hrefs).
 */
export type Announcement = {
  /** Self-owned stable render key, `ann-<hash>` — deterministic over content. */
  id: string;
  /** Posted date as ISO `YYYY-MM-DD`, from the "Posted on …" line. */
  postedAt?: string;
  /** Month bucket label, e.g. "June 2026", derived from postedAt. */
  month?: string;
  /** Free-form kind label: New / Updated / Policy / Deprecated / Incident. */
  kind?: string;
  title: string;
  summary?: string;
  /** Optional call-to-action; `href` may be an internal path or external URL. */
  link?: { label: string; href: string };
};

/** The What's New entry kinds — used to delimit one announcement from the next. */
const ANNOUNCEMENT_KINDS = ["New", "Updated", "Policy", "Deprecated", "Incident"] as const;

// "<Kind> — <Title>" (em/en-dash or a spaced hyphen) starts a new announcement.
const HEADING = new RegExp(`^(${ANNOUNCEMENT_KINDS.join("|")})\\s+[—–-]\\s+(.+)$`, "i");
// A rendered call-to-action link: "<label> (<href>)" — internal path or URL.
const LINK = /^(.+?)\s+\((\/[^()\s]+|https?:\/\/[^()\s]+)\)$/;

type DraftAnnouncement = {
  kind: string;
  title: string;
  summary: string[];
  postedAt?: string;
  link?: { label: string; href: string };
};

/**
 * Parse the page text into one {@link Announcement} per entry under the
 * `Announcements` section. Text before that header (the `Release Notes` sections)
 * is ignored, so the two parsers never cross-contaminate.
 */
export function parseAnnouncements(text: string): Announcement[] {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim());
  const start = lines.findIndex((line) => /^announcements$/i.test(line));
  if (start === -1) {
    return [];
  }

  const announcements: Announcement[] = [];
  let draft: DraftAnnouncement | undefined;

  const flush = (): void => {
    if (!draft) {
      return;
    }
    const summary = draft.summary.join(" ").trim();
    announcements.push({
      id: announcementId(draft.title, draft.postedAt),
      postedAt: draft.postedAt,
      month: monthLabel(draft.postedAt),
      kind: draft.kind,
      title: draft.title,
      summary: summary.length > 0 ? summary : undefined,
      link: draft.link,
    });
    draft = undefined;
  };

  for (const line of lines.slice(start + 1)) {
    const heading = line.match(HEADING);
    if (heading) {
      flush();
      draft = { kind: canonicalKind(heading[1]), title: heading[2].trim(), summary: [] };
      continue;
    }
    if (!draft || line.length === 0) {
      continue;
    }
    if (/^posted\b/i.test(line)) {
      draft.postedAt = parsePostedDate(line);
      continue;
    }
    const link = line.match(LINK);
    if (link) {
      draft.link = { label: link[1].trim(), href: link[2] };
      continue;
    }
    draft.summary.push(line);
  }
  flush();
  return announcements;
}

/** Normalise a matched kind back to its canonical casing (New, Policy, …). */
function canonicalKind(raw: string): string {
  return ANNOUNCEMENT_KINDS.find((kind) => kind.toLowerCase() === raw.toLowerCase()) ?? raw;
}

/**
 * Self-owned stable key — deterministic over the announcement's stable parts (so
 * a re-fetch keeps the same id), mirroring `releaseId`. Not scraped from content.
 */
function announcementId(title: string, postedAt: string | undefined): string {
  const canonical = `${postedAt ?? ""}|${title}`;
  return `ann-${createHash("sha256").update(canonical).digest("hex").slice(0, 8)}`;
}
