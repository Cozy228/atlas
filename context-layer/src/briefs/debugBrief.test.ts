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
import type { AppMutationResponse } from "@atlas/schema";
import { createResolutionContext } from "../resolvers/createResolutionContext";
import { setDevDiscoveryEnv } from "../devMocks";
import { handleAppRegistrationRequest } from "../api/appsRoutes";
import { handleLocationRegistrationRequest } from "../api/locationsRoutes";
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

  it("carries the at-read status board for the APP's registered locations (locked decision 7)", async () => {
    // A by-reference APP scope so a self-service location can be registered to it.
    const app = await handleAppRegistrationRequest({
      name: "Orion Checkout",
      landingZoneIds: ["awsf"],
      serviceSlugs: ["aws/textract"],
    });
    const appId = (app.body as AppMutationResponse).app.id;
    const ctx = await createResolutionContext({ scope: { kind: "by-reference", appId } });

    await handleLocationRegistrationRequest(ctx, {
      system: "tfe",
      kind: "workspace",
      url: "https://flightdeck.example.com/app/orion/workspaces/prod",
    });

    const brief = await assembleDebugFloor({ ctx, service: "aws/textract" });
    const floor = brief.blocks.find((block) => block.id.startsWith("debug-floor"));
    expect(floor).toBeDefined();

    // The floor now surfaces the at-read status board (locked decision 7), NOT just
    // value-free pointers: the registered tfe workspace appears as a status entry —
    // a live value, or a labeled pointer carrying a `reason` when no token is
    // configured (never a fabricated value). This reaches parity with GET /api/status.
    expect(floor?.statuses?.length ?? 0).toBeGreaterThan(0);
    expect(floor?.statuses?.some((entry) => entry.location.system === "tfe")).toBe(true);
  });
});
