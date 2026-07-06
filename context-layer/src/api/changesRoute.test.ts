import { describe, expect, it } from "vitest";
import { ChangesResponseSchema, type ChangeEvent } from "@atlas/schema";
import { handleChangesRequest, renderChangesAtom } from "./changesRoute";
import { createResolutionContext } from "../resolvers/createResolutionContext";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";
import { sharedSnapshotStore } from "../graph/snapshotStoreFactory";
import type { RootSnapshot } from "../graph/graphTypes";

/**
 * D9 — `GET /api/changes` is governed + scoped (M8): the ctx's scope filters
 * events (a service / available-in event is in scope iff its subject's LZ set
 * intersects `scope.landingZoneIds`); an unscoped ctx returns all; the Atom face
 * renders the same scoped payload. Public-safe fictional data.
 */

function event(id: string, landingZoneIds: string[], derivedAt: string): ChangeEvent {
  return {
    id,
    class: "service-added",
    subject: { kind: "service", id: `cloudx/${id}` },
    landingZoneIds,
    rootId: `availability:${landingZoneIds[0]}`,
    graphVersionFrom: "v0",
    graphVersionTo: "v1",
    derivedAt,
  };
}

async function seed(): Promise<void> {
  const repo = sharedEventsRepository(process.env);
  await repo.append([
    event("alpha-svc", ["zone-alpha"], "2026-07-01T00:00:00.000Z"),
    event("beta-svc", ["zone-beta"], "2026-07-02T00:00:00.000Z"),
  ]);
}

describe("handleChangesRequest (D9)", () => {
  it("an unscoped ctx returns the whole feed", async () => {
    await seed();
    const ctx = await createResolutionContext({});
    const result = await handleChangesRequest(ctx);
    expect(result.status).toBe(200);
    const body = ChangesResponseSchema.parse(result.body);
    expect(body.events.map((e) => e.id).sort()).toEqual(["alpha-svc", "beta-svc"]);
    expect(body.cursor).not.toBeNull();
  });

  it("a by-value scope narrows to events touching the member zones", async () => {
    await seed();
    const ctx = await createResolutionContext({
      scope: { kind: "by-value", landingZones: ["zone-alpha"] },
    });
    const result = await handleChangesRequest(ctx);
    const body = ChangesResponseSchema.parse(result.body);
    expect(body.events.map((e) => e.id)).toEqual(["alpha-svc"]);
  });

  it("since=<cursor> reads incrementally", async () => {
    await seed();
    const ctx = await createResolutionContext({});
    const all = ChangesResponseSchema.parse((await handleChangesRequest(ctx)).body);
    const firstCursor = `${all.events[0].derivedAt}#${all.events[0].id}`;
    const rest = ChangesResponseSchema.parse(
      (await handleChangesRequest(ctx, { since: firstCursor })).body,
    );
    expect(rest.events.map((e) => e.id)).toEqual(["beta-svc"]);
  });

  it("carries per-root freshness (D10): a stale root surfaces with an aging note, live roots do not", async () => {
    const store = await sharedSnapshotStore(process.env);
    const t0 = "2026-07-01T00:00:00.000Z";
    const snap = (rootId: string): RootSnapshot => ({
      rootId,
      resolvedAt: t0,
      contractVersion: "availability-v1",
      parse: {
        kind: "availability",
        landingZoneId: rootId.replace("availability:", ""),
        landingZoneName: rootId,
        services: [{ slug: "cloudx/svc", name: "Svc", domain: "AI" }],
      },
    });
    await store.compareAndSwap("availability:aging-zone", undefined, {
      confirmed: snap("availability:aging-zone"),
      pending: snap("availability:aging-zone"),
    });

    const ctx = await createResolutionContext({});
    // Read two hours after the parse (past the 1h horizon) ⇒ the root is stale.
    const body = ChangesResponseSchema.parse(
      (await handleChangesRequest(ctx, { now: new Date(Date.parse(t0) + 2 * 60 * 60 * 1000) }))
        .body,
    );
    const aging = body.roots.find((r) => r.rootId === "availability:aging-zone");
    expect(aging?.stale).toBe(true);
    expect(aging?.resolvedAt).toBe(t0); // clock never bumped to now
    expect(aging?.agingNote).toBeTruthy();

    // A read within the horizon ⇒ the SAME root reads fresh (recomputed, not stored).
    const freshBody = ChangesResponseSchema.parse(
      (await handleChangesRequest(ctx, { now: new Date(Date.parse(t0) + 60 * 1000) })).body,
    );
    const fresh = freshBody.roots.find((r) => r.rootId === "availability:aging-zone");
    expect(fresh?.stale).toBe(false);
    expect(fresh?.agingNote).toBeUndefined();
  });

  it("renders a scoped Atom feed", async () => {
    await seed();
    const ctx = await createResolutionContext({
      scope: { kind: "by-value", landingZones: ["zone-alpha"] },
    });
    const body = ChangesResponseSchema.parse((await handleChangesRequest(ctx)).body);
    const atom = renderChangesAtom(body, { scopeLabel: "zone-alpha" });
    expect(atom).toContain("<feed");
    expect(atom).toContain("<entry>");
    expect(atom).toContain("alpha-svc");
    expect(atom).not.toContain("beta-svc");
  });
});
