/**
 * D9 — the status + registration routes are governed + scoped (locked decision 8).
 * `POST/GET/DELETE /api/locations` are the registration store's only writers
 * (M11); `GET /api/status` reads the scope's live board. The registration body is
 * EXACTLY `{ system, kind, url }` — a token is structural invalidity (400). The
 * owning APP arrives from the request scope (`ctx.scope.appId`), never the body.
 *
 * Red in Batch 0: the location/status handlers throw `unimplemented`, so every
 * lifecycle assertion fails behaviorally. Green at Batch 1 (locations) / Batch 5
 * (status). Discovery is pointed at the MSW fixtures so an app can be registered
 * to scope by. All data is fictional (public-safe).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiErrorResponseSchema, type AppMutationResponse } from "@atlas/schema";
import { createResolutionContext } from "../resolvers/createResolutionContext";
import { setDevDiscoveryEnv } from "../devMocks";
import { handleAppRegistrationRequest } from "./appsRoutes";
import {
  handleLocationDeleteRequest,
  handleLocationRegistrationRequest,
  handleLocationsListRequest,
} from "./locationsRoutes";
import { handleStatusRequest } from "./statusRoute";

const savedEnv = { ...process.env };
beforeAll(() => setDevDiscoveryEnv());
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  process.env = savedEnv;
});

const REGISTRATION = {
  system: "tfe",
  kind: "workspace",
  url: "https://flightdeck.example.com/app/orion/workspaces/prod",
};

function bodyAs<T>(result: { body: unknown }): T {
  return result.body as T;
}

/** Register an APP and return a by-reference ctx scoped to it (so `ctx.scope.appId`
 *  is seated — a location belongs to an APP). */
async function ctxForNewApp() {
  const app = await handleAppRegistrationRequest({
    name: "Orion Checkout",
    landingZoneIds: ["awsf"],
    serviceSlugs: ["aws/textract"],
  });
  const appId = bodyAs<AppMutationResponse>(app).app.id;
  const ctx = await createResolutionContext({ scope: { kind: "by-reference", appId } });
  return { appId, ctx };
}

describe("D9: registration lifecycle (POST/GET/DELETE /api/locations)", () => {
  it("POST registers a location with a server id + discoveredFrom registration", async () => {
    const { ctx } = await ctxForNewApp();

    const created = await handleLocationRegistrationRequest(ctx, REGISTRATION);
    expect(created.status).toBe(201);
    const { location } = bodyAs<{
      location: { id: string; appId: string; discoveredFrom: string; system: string };
    }>(created);
    expect(location.id).toMatch(/.+/);
    expect(location.discoveredFrom).toBe("registration");
    expect(location.system).toBe("tfe");
  });

  it("POST with a token in the body → 400 (no secret ever lives in a registration)", async () => {
    const { ctx } = await ctxForNewApp();
    const forged = await handleLocationRegistrationRequest(ctx, {
      ...REGISTRATION,
      token: "sekret",
    });
    expect(forged.status).toBe(400);
    expect(ApiErrorResponseSchema.parse(forged.body).error.code).toBe("invalid_request");
  });

  it("GET lists the APP's registered locations; DELETE removes one", async () => {
    const { ctx } = await ctxForNewApp();
    const created = await handleLocationRegistrationRequest(ctx, REGISTRATION);
    const { location } = bodyAs<{ location: { id: string } }>(created);

    const list = await handleLocationsListRequest(ctx);
    expect(list.status).toBe(200);
    expect(
      bodyAs<{ locations: Array<{ id: string }> }>(list).locations.some(
        (loc) => loc.id === location.id,
      ),
    ).toBe(true);

    const removed = await handleLocationDeleteRequest(ctx, location.id);
    expect(removed.status).toBe(200);

    const after = await handleLocationsListRequest(ctx);
    expect(
      bodyAs<{ locations: Array<{ id: string }> }>(after).locations.some(
        (loc) => loc.id === location.id,
      ),
    ).toBe(false);
  });
});

describe("D9: the status board is governed + scoped (GET /api/status)", () => {
  it("returns a read-only board for the scope's registered locations", async () => {
    const { ctx } = await ctxForNewApp();
    await handleLocationRegistrationRequest(ctx, REGISTRATION);

    const status = await handleStatusRequest(ctx);
    expect(status.status).toBe(200);
    const board = bodyAs<{ statuses: Array<{ location: { id: string }; value: unknown }> }>(status);
    // A registered location shows up on the board (as a value or a labeled pointer).
    expect(board.statuses.length).toBeGreaterThan(0);
  });
});
