/**
 * Parse a newsletter email *body* into structured "What's New" entries.
 *
 * Body-only and deliberately simple: the operator pastes a complete email body
 * in a light heading format and gets back entries that map to the What's New
 * `Change` shape. MIME/.eml handling and automated ingestion are future work
 * behind this same function.
 *
 * Expected format — one entry per markdown heading:
 *
 *   ## [New] API Gateway adoption gate
 *   2026-06-04
 *   Grounded adoption journey for S3, API Gateway, and Textract.
 *
 * The heading carries an optional `[Kind]` tag (else the kind is inferred from
 * a keyword, else defaults to "Updated"); an optional ISO date line; the rest
 * is the summary.
 */

export type NewsletterKind = "New" | "Updated" | "Policy" | "Deprecated" | "Incident";

export type NewsletterEntry = {
  kind: NewsletterKind;
  title: string;
  /** ISO date `YYYY-MM-DD` when present in the body, else "". */
  date: string;
  summary: string;
};

const KINDS: readonly NewsletterKind[] = ["New", "Updated", "Policy", "Deprecated", "Incident"];
const ISO_DATE = /^\s*(\d{4}-\d{2}-\d{2})\s*$/;

export function parseNewsletter(body: string): NewsletterEntry[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const entries: NewsletterEntry[] = [];
  // ponytail: naive markdown-heading split. Known ceiling — assumes the body is
  // sectioned by `#` headings; upgrade to MIME/HTML/NLP parsing when a real
  // newsletter format demands it.
  let block: string[] | null = null;
  let heading = "";

  const flush = () => {
    if (heading) entries.push(toEntry(heading, block ?? []));
    block = null;
    heading = "";
  };

  for (const line of lines) {
    const match = line.match(/^#{1,6}\s+(.*\S)\s*$/);
    if (match) {
      flush();
      heading = match[1];
      block = [];
    } else if (block) {
      block.push(line);
    }
  }
  flush();

  return entries;
}

function toEntry(headingText: string, rest: string[]): NewsletterEntry {
  const { kind, title } = splitKind(headingText);
  const dateLine = rest.find((line) => ISO_DATE.test(line));
  const date = dateLine ? (dateLine.match(ISO_DATE)?.[1] ?? "") : "";
  const summary = rest
    .filter((line) => line !== dateLine)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
  return { kind, title: title.trim(), date, summary };
}

function splitKind(headingText: string): { kind: NewsletterKind; title: string } {
  const tagged = headingText.match(/^\[([A-Za-z]+)\]\s*(.*)$/);
  if (tagged) {
    const kind = normalizeKind(tagged[1]);
    if (kind) {
      return { kind, title: tagged[2] };
    }
  }
  for (const kind of KINDS) {
    if (new RegExp(`\\b${kind}\\b`, "i").test(headingText)) {
      return { kind, title: headingText };
    }
  }
  return { kind: "Updated", title: headingText };
}

function normalizeKind(raw: string): NewsletterKind | undefined {
  return KINDS.find((kind) => kind.toLowerCase() === raw.toLowerCase());
}
