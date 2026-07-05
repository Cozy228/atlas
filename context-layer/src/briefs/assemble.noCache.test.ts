import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Situation } from "@atlas/schema";
import {
  createResolutionContext,
  type GovernedResolutionContext,
} from "../resolvers/createResolutionContext";
import type { FetchLike } from "../resolvers/resolverTypes";
import { assembleBrief } from "./assembleBrief";
import type { BriefPlan } from "./briefTypes";
import { setDevDiscoveryEnv } from "../devMocks";

/**
 * D8 — NO brief-level cache (M4): a re-assembly re-runs the executor and reads
 * the content cache underneath (the only cache, one clock — ADR-0013 §6), never
 * a memoized `Brief`. A fetch spy proves the executor re-invokes the
 * content-cached fetch on the second assembly (a brief cache would short-circuit
 * and NOT call it); the two briefs are fresh objects with identical content.
 * Driven against the MSW discovery fixtures (public-safe `aws/textract` in `awsf`).
 *
 * Red in Batch 0: `assembleBrief` throws `unimplemented` before any fetch, so the
 * spy is never called. Green at Batch 1.
 */

const savedEnv = { ...process.env };
beforeAll(() => {
  setDevDiscoveryEnv(process.env, { referenceSpace: false });
});
afterAll(() => {
  process.env = savedEnv;
});

const SITUATION: Situation = { landingZoneIds: ["awsf"], origin: "by-value" };

function plan(): BriefPlan {
  return {
    moment: "adopt",
    situation: SITUATION,
    requests: [
      {
        subject: { kind: "service", id: "aws/textract" },
        sections: ["availability"],
        landingZoneId: "awsf",
      },
    ],
    depth: "excerpts",
  };
}

describe("assembleBrief has no brief-level cache (D8)", () => {
  it("re-assembly re-invokes the content-cached fetch and returns a fresh, identical brief", async () => {
    const base = await createResolutionContext({
      scope: { kind: "by-value", landingZones: ["awsf"] },
    });
    // Spy on the WHOLE content-cached fetch: it is invoked on every executor
    // resolution (cache hit or miss); a brief-level cache would skip it entirely.
    const fetchSpy = vi.fn(base.fetch);
    const ctx: GovernedResolutionContext = { ...base, fetch: fetchSpy as unknown as FetchLike };

    const first = await assembleBrief(plan(), ctx);
    const callsAfterFirst = fetchSpy.mock.calls.length;
    const second = await assembleBrief(plan(), ctx);
    const callsAfterSecond = fetchSpy.mock.calls.length;

    // The executor re-ran on re-assembly (no brief cache short-circuit).
    expect(callsAfterFirst).toBeGreaterThan(0);
    expect(callsAfterSecond).toBeGreaterThan(callsAfterFirst);

    // A fresh Brief object each time — never a memoized brief handed back...
    expect(first).not.toBe(second);
    // ...but identical content: the content cache underneath served the second
    // resolution (one clock), so the blocks match.
    expect(second.blocks).toEqual(first.blocks);
  });
});
