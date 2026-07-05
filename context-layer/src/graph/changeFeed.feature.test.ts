import { afterEach, describe, expect, it } from "vitest";
import { ChangesResponseSchema, type LandingZoneAvailability } from "@atlas/schema";
import { LANDING_ZONES } from "../landingZones";
import type { AvailabilityProvider } from "../services/availabilityProvider";
import { refreshGraphSnapshots } from "./refreshGraphSnapshots";
import { handleChangesRequest, renderChangesAtom } from "../api/changesRoute";
import { handleHttpRequest } from "../api/httpRoute";
import { createResolutionContext } from "../resolvers/createResolutionContext";

/**
 * FEATURE TEST — the change feed end-to-end (Step 2). Not a unit: this drives the
 * WHOLE spine as a user would experience it —
 *
 *   a source actually changes  →  discovery snapshot pass (refreshGraphSnapshots)
 *   →  per-root snapshot + CAS transition  →  two-parse stability damping
 *   →  the differ  →  the durable events store  →  GET /api/changes (governed,
 *   scope-filtered, on the real wire)  →  the Atom rendering
 *
 * — and proves the honest behaviours that matter: the first pass is SILENT
 * (baseline seed), a single changed parse emits NOTHING (damping), and only a
 * change that PERSISTS surfaces on the feed, scoped and cited. The source is a
 * controllable availability provider so the "change" is deterministic; every
 * layer downstream is the real implementation. Public-safe fictional data.
 */

const TARGET_ZONE = "awsf";
const OTHER_ZONE = LANDING_ZONES.map((z) => z.id).find((id) => id !== TARGET_ZONE);

type Svc = { id: string; name: string; domain: string };

/** An availability provider whose target-zone service list the test mutates
 *  between passes; every other LZ is honest-empty (unwired). */
function mutableProvider(getServices: () => Svc[]): AvailabilityProvider {
  return {
    async getZones(): Promise<LandingZoneAvailability[]> {
      return LANDING_ZONES.map((zone) => {
        if (zone.id !== TARGET_ZONE) {
          return { ...zone, dataStatus: "not-available", locations: [], services: [] };
        }
        return {
          ...zone,
          dataStatus: "available",
          locations: [],
          services: getServices().map((svc) => ({
            id: svc.id,
            name: svc.name,
            iconKey: svc.id,
            domain: svc.domain,
            availability: {},
          })),
        };
      });
    },
    async listServices() {
      return [];
    },
  };
}

// Isolate this file's module-shared stores (snapshot store + events repo are
// memoized first-env-wins); a fresh module registry per Vitest file already
// gives us that, and there is nothing to tear down between the ordered steps.
afterEach(() => {
  // no-op: the single ordered scenario below shares one accumulating feed by design.
});

describe("change feed feature (end-to-end spine)", () => {
  it("a persisted source change surfaces as a scoped, cited event on GET /api/changes", async () => {
    // The baseline catalogue for the target zone.
    let services: Svc[] = [{ id: "parser", name: "Parser", domain: "AI" }];
    const availabilityProvider = mutableProvider(() => services);
    // A monotonic clock so successive snapshots get distinct resolvedAt and every
    // pass is treated as a fresh refresh (past the stale horizon).
    let tick = 0;
    const now = () => new Date(Date.parse("2026-07-05T00:00:00.000Z") + tick++ * 3_600_000);
    const opts = { env: {}, availabilityProvider, now };

    // PASS 1 — cold: every root seeds its baseline SILENTLY (we don't know history
    // before we started watching), so the feed is empty.
    const pass1 = await refreshGraphSnapshots(opts);
    expect(pass1.events).toBe(0);
    expect(await feed()).toHaveLength(0);

    // The source CHANGES: a new service appears in the target zone.
    services = [
      { id: "parser", name: "Parser", domain: "AI" },
      { id: "ledger", name: "Ledger", domain: "Finance" },
    ];

    // PASS 2 — first sighting of the delta: damping HOLDS it, still zero events
    // (a single-parse flap must never reach the feed).
    const pass2 = await refreshGraphSnapshots(opts);
    expect(pass2.events).toBe(0);
    expect(await feed()).toHaveLength(0);

    // PASS 3 — the change PERSISTS across a second parse: now it is confirmed and
    // derived onto the durable feed.
    const pass3 = await refreshGraphSnapshots(opts);
    expect(pass3.events).toBeGreaterThan(0);

    // The events are on the wire, cited to their source root, and scoped correctly.
    // A brand-new service is BOTH a new node and a new edge, so it honestly emits
    // service-added AND available-in-added (the differ diffs nodes and edges
    // independently — D4).
    const all = await feed();
    const ledger = all.filter((e) => e.subject.id === "aws/ledger");
    expect(ledger.map((e) => e.class).sort()).toEqual(["available-in-added", "service-added"]);
    for (const event of ledger) {
      expect(event.landingZoneIds).toContain(TARGET_ZONE);
      expect(event.rootId).toBe(`availability:${TARGET_ZONE}`);
    }

    // Scope filter (governed read): in-scope for the target zone...
    const scoped = await feed([TARGET_ZONE]);
    expect(scoped.some((e) => e.subject.id === "aws/ledger")).toBe(true);
    // ...and out of scope for a different zone.
    if (OTHER_ZONE) {
      const elsewhere = await feed([OTHER_ZONE]);
      expect(elsewhere.some((e) => e.subject.id === "aws/ledger")).toBe(false);
    }

    // Re-running the same pass is idempotent — no doubles on the feed.
    const before = (await feed()).length;
    await refreshGraphSnapshots(opts);
    expect((await feed()).length).toBe(before);

    // The Atom face renders the same scoped payload for feed readers/agents.
    const atomCtx = await createResolutionContext({
      scope: { kind: "by-value", landingZones: [TARGET_ZONE] },
    });
    const body = ChangesResponseSchema.parse((await handleChangesRequest(atomCtx)).body);
    const atom = renderChangesAtom(body, { scopeLabel: TARGET_ZONE });
    expect(atom).toContain("<feed");
    expect(atom).toContain("service-added");
    expect(atom).toContain("aws/ledger");
  });
});

/** Read the feed through the REAL HTTP wire (`handleHttpRequest`), optionally
 *  scoped — exactly what the Portal client and an agent hit. */
async function feed(landingZones?: string[]) {
  const query = landingZones?.length ? { landingZones: landingZones.join(",") } : undefined;
  const response = await handleHttpRequest({ method: "GET", path: "/api/changes", query });
  return ChangesResponseSchema.parse(JSON.parse(response.body)).events;
}
