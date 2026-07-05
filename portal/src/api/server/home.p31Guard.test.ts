import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * D9 / P31 (home side) — the APP home's change-feed slice is the machine-DERIVED
 * feed, never the editorial What's New (P31). This guard mirrors the existing
 * `whatsNew.p31Guard` / `resolveReleaseNotes.p31Guard` in the opposite
 * direction: the home route (`routes/index.tsx`) must reuse the Step-2 changes
 * machinery (`changesQueryOptionsFor`) for its slice and must NOT import a
 * release-notes / What's-New data symbol into it — the two surfaces never merge.
 *
 * Red in Batch 0: the home is still catalog-first and imports the What's New feed
 * (`whatsNewQueryOptions`) while NOT importing the changes machinery — so both
 * assertions fail. Green at Batch 4 when I6's APP-home recomposition lands (the
 * situation card + scoped change-feed slice + moment entries). This is a source
 * scan (no dev server), so it is behaviorally red, never an import/type error.
 */

// Unambiguous identifiers (never English substrings, so a comment word like
// "What's new" can't false-positive) — the release-notes / editorial data path.
// Scanned over the import block only.
const FORBIDDEN = ["whatsNewQueryOptions", "fetchWhatsNew", "WhatsNewFeed", "resolveReleaseNotes"];

// The changes machinery the home slice must reuse (Step-2 scoped feed).
const REQUIRED = "changesQueryOptionsFor";

/** The import block: every line up to the first non-import statement. */
function importBlock(source: string): string {
  const lines = source.split("\n");
  const end = lines.findIndex(
    (line, i) => i > 0 && /^(export|const|function|class|type|async|let)/.test(line.trim()),
  );
  return lines.slice(0, end === -1 ? lines.length : end).join("\n");
}

describe("the APP home reuses the changes machinery, not release notes (D9/P31)", () => {
  const imports = importBlock(
    readFileSync(fileURLToPath(new URL("../../routes/index.tsx", import.meta.url)), "utf8"),
  );

  it("imports the Step-2 changes machinery for its change-feed slice", () => {
    expect(imports).toContain(REQUIRED);
  });

  it("imports no release-notes / What's-New data symbol", () => {
    for (const symbol of FORBIDDEN) {
      expect(imports).not.toContain(symbol);
    }
  });
});
