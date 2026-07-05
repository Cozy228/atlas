import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * D12 / P31 — the machine-derived change feed and the editorial What's New are
 * two different surfaces, and Step 2 does NOT rewire What's New. This guard fails
 * loudly if the What's New server path ever imports a graph/differ/change-feed
 * symbol: the newsletter must stay a pure live projection of the federated
 * Confluence "What's New" page (`resolveReleaseNotes`), independent of the graph layer.
 */

// Unambiguous identifiers (never English substrings, so a comment word can't
// false-positive). The What's New path imports only release-notes + the
// governance-gate factory — none of these.
const FORBIDDEN = [
  "deriveGraph",
  "diffGraphVersions",
  "snapshotTransition",
  "serveRootSnapshot",
  "SnapshotStore",
  "handleChangesRequest",
  "renderChangesAtom",
  "ChangeEvent",
  "EventsRepository",
];

describe("What's New stays independent of the graph layer (P31)", () => {
  it("whatsNew.ts imports no differ / graph / change-feed symbol", () => {
    const source = readFileSync(fileURLToPath(new URL("./whatsNew.ts", import.meta.url)), "utf8");
    for (const symbol of FORBIDDEN) {
      expect(source).not.toContain(symbol);
    }
  });
});
