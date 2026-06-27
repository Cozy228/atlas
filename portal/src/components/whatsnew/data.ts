/**
 * What's New broadsheet model.
 *
 * The broadsheet renders the newsletter's standalone **announcements** (the
 * single newsletter source, loaded via the announcements feed), mapped here
 * into the `Change` view-model the layout reads. Formal
 * releases are rendered separately by `ReleasesSection`. No fixtures live here
 * anymore; `changesFromAnnouncements` is the only producer.
 */
import type { Announcement } from "@/api/server/announcements";

export type ChangeKind = "New" | "Updated" | "Policy" | "Deprecated" | "Incident";

export type ChangeTone = "success" | "info" | "warning" | "critical";

export type Change = {
  id: string;
  /** Display date, e.g. "Jun 4, 2026". */
  date: string;
  /** Sort key (newest first), e.g. "2026-06-04". */
  iso: string;
  /** Month bucket label, e.g. "June 2026". */
  month: string;
  kind: ChangeKind;
  tone: ChangeTone;
  title: string;
  summary: string;
  link?: { label: string; href: string };
};

const CHANGE_KINDS: ReadonlyArray<ChangeKind> = [
  "New",
  "Updated",
  "Policy",
  "Deprecated",
  "Incident",
];

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-06-11" / "2026-06-11T09:30" -> "Jun 11, 2026". */
function friendlyDate(iso: string): string | undefined {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return undefined;
  const month = SHORT_MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}, ${m[1]}` : undefined;
}

function toKind(raw: string | undefined): ChangeKind {
  return CHANGE_KINDS.includes(raw as ChangeKind) ? (raw as ChangeKind) : "Updated";
}

/** Map newsletter announcements into the broadsheet view-model (feed order kept). */
export function changesFromAnnouncements(
  announcements: ReadonlyArray<Announcement>,
): ReadonlyArray<Change> {
  return announcements.map((a, i) => {
    const kind = toKind(a.kind);
    const iso = a.postedAt ?? "";
    return {
      id: a.id || `announcement-${i}`,
      date: friendlyDate(iso) ?? a.month ?? "",
      iso,
      month: a.month ?? "Undated",
      kind,
      tone: KIND_TONE[kind],
      title: a.title,
      summary: a.summary ?? "",
      link: a.link,
    };
  });
}

export const KIND_TONE: Record<ChangeKind, ChangeTone> = {
  New: "success",
  Updated: "info",
  Policy: "warning",
  Deprecated: "critical",
  Incident: "info",
};

export const TONE_DOT: Record<ChangeTone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  critical: "bg-critical",
};

/** Count of entries per kind, in display order. */
export function kindCounts(
  changes: ReadonlyArray<Change>,
): ReadonlyArray<{ kind: ChangeKind; count: number }> {
  return CHANGE_KINDS.map((kind) => ({
    kind,
    count: changes.filter((c) => c.kind === kind).length,
  })).filter((entry) => entry.count > 0);
}

/** Anchor id for a month section, e.g. "month-june-2026". */
export function monthAnchor(month: string): string {
  return `month-${month.toLowerCase().replace(/\s+/g, "-")}`;
}
