/**
 * D8 — the debug brief FLOOR (M7): the debug moment assembles the target
 * capability's troubleshooting sections as CITED Evidence PLUS the location
 * index's pointers as the operational floor (content is the bar, locations are the
 * floor — P18). `explain_error(app, error?)`'s first version routes to THIS floor;
 * free-text error interpretation stays client-side (P12/P15). This replaces
 * Step 4's honest not-yet-available `debug` template.
 *
 * Red in Batch 0: `assembleDebugFloor` throws `unimplemented`, so every floor
 * assertion fails behaviorally. Green at Batch 5. The MSW discovery fixtures are
 * pointed at so Batch 5's real content resolution has a substrate. Public-safe.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createResolutionContext } from "../resolvers/createResolutionContext";
import { setDevDiscoveryEnv } from "../devMocks";
import { assembleDebugFloor } from "./debugFloor";

const savedEnv = { ...process.env };
beforeAll(() => setDevDiscoveryEnv());
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  process.env = savedEnv;
});

describe("D8: the debug brief floor (M7)", () => {
  it("assembles cited Evidence AND the location-index pointers for the target capability", async () => {
    const ctx = await createResolutionContext({
      scope: { kind: "by-value", landingZones: ["awsf"], services: ["aws/textract"] },
    });

    const brief = await assembleDebugFloor({ ctx, service: "aws/textract" });

    // A debug brief, not an honest-empty not-yet-available response.
    expect(brief.moment).toBe("debug");
    expect(brief.blocks.length).toBeGreaterThan(0);

    // Content is the bar: at least one block carries CITED troubleshooting Evidence.
    expect(brief.blocks.some((block) => block.evidence.length > 0)).toBe(true);
    // Locations are the floor: the location index's pointers ride the brief
    // (existence + provenance, uncited — ADR-0003).
    expect(brief.blocks.some((block) => block.pointers.length > 0)).toBe(true);
  });
});
