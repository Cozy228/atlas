import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * D12 / P31 — the release-notes resolver (the What's New source of truth) must
 * stay a pure Confluence-page projection, never coupled to the graph/differ.
 * If this file starts importing a change-feed symbol, the editorial and derived
 * surfaces have been conflated — exactly what P31 forbids.
 */

// Unambiguous identifiers + relative module paths (never English substrings, so
// a comment word like "differently" can't false-positive). Scanned over the
// import block only.
const FORBIDDEN = [
  "deriveGraph",
  "diffGraphVersions",
  "snapshotTransition",
  "serveRootSnapshot",
  "handleChangesRequest",
  "ChangeEvent",
  "EventsRepository",
  '"../graph/',
  '"../changes/',
  "repositories/eventsRepository",
];

/** The import block: every line up to the first non-import statement. */
function importBlock(source: string): string {
  const lines = source.split("\n");
  const end = lines.findIndex(
    (line, i) => i > 0 && /^(export|const|function|class|type|async|let|\/\*\*)/.test(line.trim()),
  );
  return lines.slice(0, end === -1 ? lines.length : end).join("\n");
}

describe("resolveReleaseNotes stays independent of the graph layer (P31)", () => {
  it("imports no differ / graph / change-feed symbol", () => {
    const imports = importBlock(
      readFileSync(fileURLToPath(new URL("./resolveReleaseNotes.ts", import.meta.url)), "utf8"),
    );
    for (const symbol of FORBIDDEN) {
      expect(imports).not.toContain(symbol);
    }
  });
});
