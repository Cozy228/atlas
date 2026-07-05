import { describe, expect, it } from "vitest";
import type { Brief, ChangeEvent } from "@atlas/schema";
import { handleBriefRequest } from "../api/briefsRoute";
import { createResolutionContext } from "../resolvers/createResolutionContext";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";
import { eventCursor } from "../repositories/eventsRepository";

/**
 * D6 — the change brief reads the Step-2 feed (`handleChangesRequest` / the
 * `events` store), scoped to the situation, cites each event, and `since=` reads
 * incrementally (M8/P31 — the DERIVED feed, never the editorial What's New).
 * Public-safe fictional data.
 *
 * Red in Batch 0: `handleBriefRequest` throws `unimplemented`. Green at Batch 4/5.
 */

const T1 = "2026-07-01T00:00:00.000Z";
const T2 = "2026-07-02T00:00:00.000Z";
const T3 = "2026-07-03T00:00:00.000Z";

const ALPHA_1: ChangeEvent = {
  id: "alpha-avail-parser",
  class: "available-in-added",
  subject: { kind: "service", id: "cloudx/parser" },
  object: { kind: "landingZone", id: "zone-alpha" },
  landingZoneIds: ["zone-alpha"],
  rootId: "availability:zone-alpha",
  graphVersionFrom: "v0",
  graphVersionTo: "v1",
  derivedAt: T1,
};

const ALPHA_2: ChangeEvent = {
  id: "alpha-module-parser",
  class: "module-version-changed",
  subject: { kind: "service", id: "cloudx/parser" },
  object: { kind: "module", id: "acme/parser/cloudx" },
  landingZoneIds: ["zone-alpha"],
  from: "1.2.0",
  to: "1.3.0",
  rootId: "terraform",
  graphVersionFrom: "v1",
  graphVersionTo: "v2",
  derivedAt: T3,
};

const BETA_1: ChangeEvent = {
  id: "beta-avail-vault",
  class: "available-in-added",
  subject: { kind: "service", id: "cloudx/vault" },
  object: { kind: "landingZone", id: "zone-beta" },
  landingZoneIds: ["zone-beta"],
  rootId: "availability:zone-beta",
  graphVersionFrom: "v0",
  graphVersionTo: "v1",
  derivedAt: T2,
};

async function seed(): Promise<void> {
  await sharedEventsRepository(process.env).append([ALPHA_1, ALPHA_2, BETA_1]);
}

describe("change brief (D6)", () => {
  it("scopes to the situation's zones and cites each in-scope event", async () => {
    await seed();
    const ctx = await createResolutionContext({
      scope: { kind: "by-value", landingZones: ["zone-alpha"] },
    });
    const result = await handleBriefRequest("change", ctx, {});
    expect(result.status).toBe(200);
    const brief = result.body as Brief;
    const json = JSON.stringify(brief);
    // The in-scope (zone-alpha) events are present...
    expect(json).toContain("cloudx/parser");
    // ...and the out-of-scope (zone-beta) event is filtered out (scoped feed).
    expect(json).not.toContain("cloudx/vault");
    expect(brief.blocks.length).toBeGreaterThan(0);
  });

  it("since=<cursor> reads incrementally (later events only)", async () => {
    await seed();
    const ctx = await createResolutionContext({
      scope: { kind: "by-value", landingZones: ["zone-alpha"] },
    });
    const result = await handleBriefRequest("change", ctx, { since: eventCursor(ALPHA_1) });
    expect(result.status).toBe(200);
    const json = JSON.stringify(result.body as Brief);
    // The earliest event is behind the cursor; only the later one remains.
    expect(json).toContain("1.3.0");
    expect(json).not.toContain("alpha-avail-parser");
  });
});
