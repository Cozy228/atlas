import { describe, expect, it } from "vitest";
import { ChangesResponseSchema, type ChangeEvent } from "@atlas/schema";
import { handleChangesRequest, renderChangesAtom } from "./changesRoute";
import { createResolutionContext } from "../resolvers/createResolutionContext";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";

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
