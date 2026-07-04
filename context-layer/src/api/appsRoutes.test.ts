/**
 * D2 + D3 — consumer-state routes (Step 3, mid-level §3; locked decisions 4, 5).
 *
 * D2 lifecycle: POST → 201 + server id; GET list/id; PATCH updates + bumps
 * `updatedAt`; `origin` always `self-declared`; every mutation logs through the
 * `apps` pino channel (M3: identity-free but never silent).
 * D3 dangling declarations: unknown `serviceSlugs` / `landingZoneIds` are stored
 * VERBATIM and reported in `warnings[]` (`unknown_service`,
 * `unknown_landing_zone` — asserted as runtime strings; the codes join the
 * schema union in Batch 1), never dropped; structural invalidity is a 400.
 *
 * Discovery is the single live path (plan 018 G5): point every channel at the
 * MSW fixtures so `aws/textract` is a discovered service the target-existence
 * check accepts. All app data is fictional (public-safe).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ApiErrorResponseSchema } from "@atlas/schema";
import { logger } from "../observability/logging";
import { setDevDiscoveryEnv } from "../devMocks";
import {
  handleAppRegistrationRequest,
  handleAppRequest,
  handleAppsListRequest,
  handleAppUpdateRequest,
} from "./appsRoutes";

// The shared Node-mode MSW server is booted by the global `devMocks/setup.ts`
// (context-layer vitest `setupFiles`) — this file only points discovery at the
// fixtures, exactly like `feedbackRoute.test.ts`.
const savedEnv = { ...process.env };
beforeAll(() => setDevDiscoveryEnv());
afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  process.env = savedEnv;
});

/** A registration whose declarations all resolve against discovered records. */
const CLEAN_REGISTRATION = {
  name: "Orion Checkout",
  landingZoneIds: ["awsf"],
  serviceSlugs: ["aws/textract"],
};

function bodyAs<T>(result: { body: unknown }): T {
  return result.body as T;
}

describe("D2: apps registration lifecycle", () => {
  it("POST registers with a server id + origin self-declared, and logs the mutation", async () => {
    const infoSpy = vi.spyOn(logger("apps"), "info");

    const created = await handleAppRegistrationRequest(CLEAN_REGISTRATION);
    expect(created.status).toBe(201);
    const { app, warnings } = bodyAs<{
      app: { id: string; name: string; origin: string; landingZoneIds: string[] };
      warnings: unknown[];
    }>(created);

    expect(app.id).toMatch(/.+/);
    expect(app.name).toBe("Orion Checkout");
    expect(app.origin).toBe("self-declared");
    expect(app.landingZoneIds).toEqual(["awsf"]);
    // Clean declarations → no dangling-declaration warnings.
    expect(warnings).toEqual([]);
    // M3: the mutation is logged (identity-free but never silent).
    expect(infoSpy).toHaveBeenCalled();
  });

  it("GET list includes the registered app; GET by id returns it", async () => {
    const created = await handleAppRegistrationRequest(CLEAN_REGISTRATION);
    const { app } = bodyAs<{ app: { id: string } }>(created);

    const list = await handleAppsListRequest();
    expect(list.status).toBe(200);
    const { apps } = bodyAs<{ apps: Array<{ id: string }> }>(list);
    expect(apps.some((entry) => entry.id === app.id)).toBe(true);

    const read = await handleAppRequest(app.id);
    expect(read.status).toBe(200);
    expect(bodyAs<{ app: { id: string } }>(read).app.id).toBe(app.id);
  });

  it("GET by unknown id → 404 app_not_found (an APP is a scope entity, not a Resource)", async () => {
    const read = await handleAppRequest("app-does-not-exist");
    expect(read.status).toBe(404);
    // app_not_found joins apiErrorCodes in Batch 1 — asserted as a runtime string.
    expect(ApiErrorResponseSchema.parse(read.body).error.code).toBe("app_not_found");
  });

  it("PATCH updates the mutable fields, bumps updatedAt, keeps origin self-declared, and logs", async () => {
    const created = await handleAppRegistrationRequest(CLEAN_REGISTRATION);
    const { app } = bodyAs<{ app: { id: string; declaredAt: string; updatedAt: string } }>(created);

    // Let wall-clock advance so the updatedAt bump is observable.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const infoSpy = vi.spyOn(logger("apps"), "info");
    const patched = await handleAppUpdateRequest(app.id, { name: "Orion Payments" });
    expect(patched.status).toBe(200);
    const updated = bodyAs<{
      app: { name: string; origin: string; declaredAt: string; updatedAt: string };
    }>(patched).app;

    expect(updated.name).toBe("Orion Payments");
    expect(updated.origin).toBe("self-declared");
    expect(updated.declaredAt).toBe(app.declaredAt);
    expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
      new Date(app.updatedAt).getTime(),
    );
    expect(infoSpy).toHaveBeenCalled();
  });

  it("PATCH on an unknown id → 404 app_not_found", async () => {
    const patched = await handleAppUpdateRequest("app-does-not-exist", { name: "x" });
    expect(patched.status).toBe(404);
    expect(ApiErrorResponseSchema.parse(patched.body).error.code).toBe("app_not_found");
  });
});

describe("D3: dangling declarations are stored verbatim and warned, never dropped", () => {
  it("keeps unknown serviceSlugs + landingZoneIds and reports both warning codes", async () => {
    const created = await handleAppRegistrationRequest({
      name: "Nebula",
      landingZoneIds: ["awsf", "zzz-unknown-zone"],
      serviceSlugs: ["aws/textract", "aws/not-a-real-service"],
    });
    expect(created.status).toBe(201);
    const { app, warnings } = bodyAs<{
      app: { id: string; landingZoneIds: string[]; serviceSlugs: string[] };
      warnings: Array<{ code: string }>;
    }>(created);

    // Verbatim: the unknown entries are KEPT (a manifest legitimately declares a
    // service Atlas has not discovered yet — that gap is signal, not error).
    expect(app.landingZoneIds).toEqual(["awsf", "zzz-unknown-zone"]);
    expect(app.serviceSlugs).toEqual(["aws/textract", "aws/not-a-real-service"]);

    const codes = warnings.map((warning) => warning.code);
    expect(codes).toContain("unknown_service");
    expect(codes).toContain("unknown_landing_zone");

    // ...and the stored record still carries them on read.
    const read = await handleAppRequest(app.id);
    expect(bodyAs<{ app: { serviceSlugs: string[] } }>(read).app.serviceSlugs).toContain(
      "aws/not-a-real-service",
    );
  });

  it("structural invalidity (empty name) is a 400, not a warning", async () => {
    const created = await handleAppRegistrationRequest({
      name: "",
      landingZoneIds: ["awsf"],
    });
    expect(created.status).toBe(400);
    expect(ApiErrorResponseSchema.parse(created.body).error.code).toBe("invalid_request");
  });

  it("a caller-supplied origin is structural invalidity → 400 (origin is server-set)", async () => {
    const created = await handleAppRegistrationRequest({
      name: "Forged",
      landingZoneIds: ["awsf"],
      origin: "registry",
    });
    expect(created.status).toBe(400);
    expect(ApiErrorResponseSchema.parse(created.body).error.code).toBe("invalid_request");
  });
});
