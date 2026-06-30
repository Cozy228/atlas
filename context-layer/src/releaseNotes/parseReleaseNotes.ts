import { createHash } from "node:crypto";

/**
 * Parse the federated-platform **release-notes Confluence page** into structured
 * release records.
 *
 * The page lists releases (bi-monthly) with a "Release Scope" broken into
 * categories (Non-Compute / Compute / …), each a numbered list of items that
 * end in a Jira-style ticket (`[ABC-1234]`, or a bare `ABC-1234`), plus trailing
 * metadata (the change request `CHG…`, the Viva Engage post date, etc.).
 *
 * Body-only today: the caller passes the page's text (the live Confluence
 * provider can feed it later). Returns one release per "Release Notes" section.
 */

export type ReleaseItem = {
  category: string;
  index: number;
  title: string;
  /** Jira-style id, e.g. "PLAT-1574", when present. */
  ticket?: string;
};

/** A related link on the release (Jira release, DOP, Go/No-Go, Viva Engage…). */
export type ReleaseResource = {
  label: string;
  /** Omitted for a reference that has no link (e.g. "attached in ServiceNow"). */
  url?: string;
};

export type Release = {
  /** Our own stable routing key, `rel-<hash>` — deterministic over content. */
  id: string;
  /** Month bucket label, e.g. "May 2026", derived from the posted date. */
  month?: string;
  /** ServiceNow change request, e.g. "CHG1052711". */
  changeRequest?: string;
  /** Posted date as ISO `YYYY-MM-DD`, from the Viva Engage line. */
  postedAt?: string;
  /** Link to the source of record (Confluence release-notes page). */
  link?: string;
  /** Jira base URL; an item ticket links to `<jiraBase>/browse/<ticket>`. */
  jiraBase?: string;
  items: ReleaseItem[];
  /** Related links: Jira release, change request, DOP, Go/No-Go, Viva Engage… */
  resources?: ReleaseResource[];
  /** Who to contact with questions, e.g. "AWSF Operations Team — ops@…". */
  support?: string;
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

// Generic Jira-style key (PROJECT-1234), not any specific project.
const TICKET = /\b([A-Z][A-Z0-9]+-\d+)\b/;
const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

/**
 * Parse a release-notes page into one {@link Release} per release. The page is
 * bi-monthly (roughly twice a month), so a single month can hold several
 * releases — each release section is delimited by a "Release Notes" header.
 */
export function parseReleaseNotes(text: string): Release[] {
  return splitReleaseBlocks(text)
    .map(parseOneRelease)
    .filter((release) => release.items.length > 0 || release.changeRequest);
}

/** Split the page on "Release Notes" headers; one block per release section. */
function splitReleaseBlocks(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (/^\s*[•·]?\s*release notes\b/i.test(line) && current.length) {
      blocks.push(current.join("\n"));
      current = [];
    }
    current.push(line);
  }
  if (current.length) {
    blocks.push(current.join("\n"));
  }
  return blocks.length ? blocks : [text];
}

function parseOneRelease(block: string): Release {
  const lines = block.replace(/\r\n/g, "\n").split("\n").map(stripBullet);
  const items: ReleaseItem[] = [];
  let inScope = false;
  let category = "";

  for (const line of lines) {
    if (/^release scope:?$/i.test(line)) {
      inScope = true;
      continue;
    }
    if (!inScope) {
      continue;
    }

    // Trailing metadata begins — the scope list is over.
    if (/^for this release\b/i.test(line) || /^additional details:?$/i.test(line)) {
      inScope = false;
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s*(.+)$/);
    if (numbered && category) {
      const { title, ticket } = splitTicket(numbered[2]);
      items.push({ category, index: Number(numbered[1]), title, ticket });
      continue;
    }

    const heading = line.match(/^([A-Za-z][A-Za-z0-9 /&-]*):$/);
    if (heading) {
      category = heading[1].trim();
    }
  }

  const changeRequest = block.match(/\b(CHG\d+)\b/)?.[1];
  const postedAt = parsePostedDate(block);

  return {
    id: releaseId(postedAt, changeRequest, items),
    month: monthLabel(postedAt),
    changeRequest,
    postedAt,
    items,
  };
}

/**
 * Our own stable, unique key — not scraped as-is from the content. Deterministic
 * over the release's stable parts (so a re-fetch keeps the same id), and it works
 * for a release with no change request, the same way a standalone announcement
 * would. `index` is intentionally excluded so reordering the page is stable.
 */
function releaseId(
  postedAt: string | undefined,
  changeRequest: string | undefined,
  items: ReleaseItem[],
): string {
  const canonical = [
    postedAt ?? "",
    changeRequest ?? "",
    ...items.map((i) => i.ticket ?? i.title),
  ].join("|");
  return `rel-${createHash("sha256").update(canonical).digest("hex").slice(0, 8)}`;
}

/** "2026-05" → "May 2026". Shared with the announcement parser. */
export function monthLabel(iso: string | undefined): string | undefined {
  const match = iso?.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) {
    return undefined;
  }
  const name = MONTH_NAMES[Number(match[2]) - 1];
  return name ? `${name} ${match[1]}` : undefined;
}

function splitTicket(raw: string): { title: string; ticket?: string } {
  const ticket = raw.match(TICKET)?.[1];
  const title = (ticket ? raw.replace(/\[?\s*[A-Z][A-Z0-9]+-\d+\s*\]?/, " ") : raw)
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/, "")
    .trim();
  return { title, ticket };
}

/** Extract `YYYY-MM-DD` from a "… on <day> <Month>, <year>" line; shared. */
export function parsePostedDate(text: string): string | undefined {
  const match = text.match(/on\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})/i);
  if (!match) {
    return undefined;
  }
  const month = MONTHS[match[2].toLowerCase()];
  return month ? `${match[3]}-${month}-${match[1].padStart(2, "0")}` : undefined;
}

function stripBullet(line: string): string {
  return line.replace(/^[\s•·]+/, "").trim();
}
