/**
 * Parse the federated-platform **release-notes Confluence page** into structured
 * release records.
 *
 * The page lists releases (bi-monthly) with a "Release Scope" broken into
 * categories (Non-Compute / Compute / …), each a numbered list of items that
 * end in a Jira ticket (`[AFCN-1234]`, or a bare `AFCN-1234`), plus trailing
 * metadata (the change request `CHG…`, the Viva Engage post date, etc.).
 *
 * Body-only today: the caller passes the page's text (the live Confluence
 * provider can feed it later). This parses a single release block; splitting a
 * multi-month page into several is a thin future extension.
 */

export type ReleaseItem = {
  category: string;
  index: number;
  title: string;
  /** Jira id, e.g. "AFCN-11574", when present. */
  ticket?: string;
};

export type Release = {
  /** ServiceNow change request, e.g. "CHG1052711". */
  changeRequest?: string;
  /** Posted date as ISO `YYYY-MM-DD`, from the Viva Engage line. */
  postedAt?: string;
  items: ReleaseItem[];
};

const TICKET = /\b(AFCN-\d+)\b/;
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

export function parseReleaseNotes(text: string): Release {
  const lines = text.replace(/\r\n/g, "\n").split("\n").map(stripBullet);
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

  return {
    changeRequest: text.match(/\b(CHG\d+)\b/)?.[1],
    postedAt: parsePostedDate(text),
    items,
  };
}

function splitTicket(raw: string): { title: string; ticket?: string } {
  const ticket = raw.match(TICKET)?.[1];
  const title = (ticket ? raw.replace(/\[?\s*AFCN-\d+\s*\]?/, " ") : raw)
    .replace(/\s+/g, " ")
    .replace(/[.\s]+$/, "")
    .trim();
  return { title, ticket };
}

function parsePostedDate(text: string): string | undefined {
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
