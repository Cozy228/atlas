import { describe, expect, it } from "vitest";
import type { BriefBlock, Situation } from "@atlas/schema";
import {
  createResolutionContext,
  type GovernedResolutionContext,
} from "../resolvers/createResolutionContext";
import type { FetchLike } from "../resolvers/resolverTypes";
import { assembleBrief } from "./assembleBrief";
import type { BriefPlan } from "./briefTypes";

/**
 * D3 — honest-empty is a first-class result (ADR-0013 §4, locked decision 3),
 * table-driven: MISSING data ⇒ an `unresolved` block + a warning, NEVER an absent
 * block; a FAILED fetch ⇒ a `partial` block + a warning, NEVER silent truncation.
 * Absence of data is not a negative fact. Public-safe fictional data.
 *
 * Red in Batch 0: `assembleBrief` throws `unimplemented`, so every honest-empty
 * assertion fails behaviorally. Green when Batch 1 lands the executor.
 */

const SITUATION: Situation = {
  landingZoneIds: ["zone-alpha", "zone-beta"],
  origin: "by-value",
};

/** Two planned blocks over fictional subjects — the honesty check does not care
 *  which sections, only that a resolution gap yields an honest block, not a hole. */
function plan(): BriefPlan["requests"] {
  return [
    {
      subject: { kind: "service", id: "cloudx/parser" },
      sections: ["availability"],
      landingZoneId: "zone-alpha",
    },
    {
      subject: { kind: "service", id: "cloudx/parser" },
      sections: ["security"],
      landingZoneId: "zone-beta",
    },
  ];
}

/** Spread-override the governed context's fetch (the brand is preserved by
 *  spread — the factory already governed it at construction). */
function withFetch(base: GovernedResolutionContext, fetch: FetchLike): GovernedResolutionContext {
  return { ...base, fetch };
}

/** A fetch that always 404s: the section has no resolvable source (MISSING). */
const notFoundFetch: FetchLike = async () => ({ ok: false, status: 404, json: async () => ({}) });

/** A fetch that always throws: the source existed but the fetch FAILED. */
const failingFetch: FetchLike = async () => {
  throw new Error("simulated upstream failure");
};

async function assemble(fetch: FetchLike): Promise<BriefBlock[]> {
  const base = await createResolutionContext({
    scope: { kind: "by-value", landingZones: SITUATION.landingZoneIds },
  });
  const brief = await assembleBrief(
    { moment: "adopt", situation: SITUATION, requests: plan(), depth: "excerpts" },
    withFetch(base, fetch),
  );
  return brief.blocks;
}

describe("assembleBrief honest-empty (D3)", () => {
  it("missing data ⇒ an unresolved block + a warning, never an absent block", async () => {
    const blocks = await assemble(notFoundFetch);
    // Never dropped: one honest block per planned request (absence ≠ omission).
    expect(blocks).toHaveLength(plan().length);
    for (const block of blocks) {
      expect(block.status).toBe("unresolved");
      expect(block.warnings.length).toBeGreaterThan(0);
      // No fabricated content: an unresolved block carries no cited excerpts.
      expect(block.evidence).toHaveLength(0);
    }
  });

  it("a failed fetch ⇒ a warned block, never silent truncation or a fabricated body", async () => {
    const blocks = await assemble(failingFetch);
    expect(blocks).toHaveLength(plan().length);
    for (const block of blocks) {
      // A failed fetch is honest-empty, never presented as fully resolved.
      expect(block.status).not.toBe("available");
      expect(block.warnings.length).toBeGreaterThan(0);
      // Never truncation: any evidence surfaced must still be a real citation,
      // not a silently clipped body.
      for (const evidence of block.evidence) {
        expect(evidence.citations.length).toBeGreaterThan(0);
      }
    }
  });
});
