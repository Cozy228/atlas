/**
 * D1 — operational-location registration schema contracts (Step 7, locked
 * decision 1: mid-level §1, M12/M3, ADR-0003). The registration request is
 * EXACTLY `{ system, kind, url }`: a `token`/`secret`/any unknown field is
 * structural invalidity (a token in a registration would be a secret store + an
 * SSRF proxy at once — the rejected shape). `LocationRecord` is the stored
 * consumer-state pointer; `LocationStatus` carries the uncited at-read value with
 * NO citation field (ADR-0003).
 *
 * These use `safeParse(...).success` rather than `.parse(...).toThrow()` so the
 * ACCEPT cases are red until Batch 1/4 land the real zod shapes (the Batch-0
 * stubs throw on any parse) and go green only when the real schema exists — red
 * for behavioral reasons, exactly as the frozen-suite discipline requires. All
 * data is fictional (public-safe).
 */
import { describe, expect, it } from "vitest";
import {
  LocationListResponseSchema,
  LocationRecordSchema,
  LocationRegistrationRequestSchema,
  LocationRegistrationResponseSchema,
  LocationStatusReasonSchema,
  LocationStatusEntrySchema,
  StatusBoardResponseSchema,
} from "./src/index";

const VALID_REGISTRATION = {
  system: "flightdeck",
  kind: "workspace",
  url: "https://flightdeck.example.com/workspaces/orion-prod",
};

const VALID_RECORD = {
  id: "loc-fictional-orion-workspace",
  appId: "app-fictional-orion",
  system: "flightdeck",
  kind: "workspace",
  url: "https://flightdeck.example.com/workspaces/orion-prod",
  discoveredFrom: "registration",
  registeredAt: "2026-07-06T00:00:00.000Z",
};

const VALID_STATUS_VALUE = {
  location: {
    id: "loc-fictional-orion-workspace",
    system: "flightdeck",
    kind: "workspace",
    url: "https://flightdeck.example.com/workspaces/orion-prod",
    discoveredFrom: "registration",
  },
  value: "applied",
  fetchedAt: "2026-07-06T12:00:00.000Z",
};

const VALID_STATUS_POINTER = {
  location: {
    id: "loc-fictional-orion-dashboard",
    system: "observatory",
    kind: "dashboard",
    url: "https://observatory.example.com/d/orion",
    discoveredFrom: "registration",
  },
  value: null,
  reason: "no-adapter",
  fetchedAt: null,
};

describe("D1: LocationRegistrationRequestSchema", () => {
  it("accepts a valid registration (system + kind + url only)", () => {
    expect(LocationRegistrationRequestSchema.safeParse(VALID_REGISTRATION).success).toBe(true);
  });

  it("rejects a registration carrying a token (no secret ever lives in a registration)", () => {
    expect(
      LocationRegistrationRequestSchema.safeParse({ ...VALID_REGISTRATION, token: "sekret" })
        .success,
    ).toBe(false);
  });

  it("rejects a registration carrying a secret field (structural invalidity → 400)", () => {
    expect(
      LocationRegistrationRequestSchema.safeParse({ ...VALID_REGISTRATION, secret: "sekret" })
        .success,
    ).toBe(false);
  });

  it("rejects a caller-supplied id/appId (server-owned)", () => {
    expect(
      LocationRegistrationRequestSchema.safeParse({ ...VALID_REGISTRATION, id: "loc-forged" })
        .success,
    ).toBe(false);
    expect(
      LocationRegistrationRequestSchema.safeParse({ ...VALID_REGISTRATION, appId: "app-forged" })
        .success,
    ).toBe(false);
  });

  it("rejects an unknown location kind (closed set)", () => {
    expect(
      LocationRegistrationRequestSchema.safeParse({ ...VALID_REGISTRATION, kind: "database" })
        .success,
    ).toBe(false);
  });

  it("rejects an empty system / url", () => {
    expect(
      LocationRegistrationRequestSchema.safeParse({ ...VALID_REGISTRATION, system: "" }).success,
    ).toBe(false);
    expect(
      LocationRegistrationRequestSchema.safeParse({ ...VALID_REGISTRATION, url: "" }).success,
    ).toBe(false);
  });
});

describe("D1: LocationRecordSchema", () => {
  it("accepts a full stored record (server-set id/registeredAt + appId scope)", () => {
    expect(LocationRecordSchema.safeParse(VALID_RECORD).success).toBe(true);
  });

  it("rejects an unknown field (strict — no secret rides the stored record either)", () => {
    expect(LocationRecordSchema.safeParse({ ...VALID_RECORD, token: "sekret" }).success).toBe(
      false,
    );
  });

  it("rejects a record missing its appId scope", () => {
    const withoutApp: Record<string, unknown> = { ...VALID_RECORD };
    delete withoutApp.appId;
    expect(LocationRecordSchema.safeParse(withoutApp).success).toBe(false);
  });
});

describe("D1: LocationStatus — the uncited at-read value (ADR-0003)", () => {
  it("accepts a live value entry (value present, no citation field exists)", () => {
    expect(LocationStatusEntrySchema.safeParse(VALID_STATUS_VALUE).success).toBe(true);
  });

  it("accepts a labeled-pointer entry (value null + a degradation reason)", () => {
    expect(LocationStatusEntrySchema.safeParse(VALID_STATUS_POINTER).success).toBe(true);
  });

  it("rejects a citation on a value (a value is operational status, never Evidence)", () => {
    expect(
      LocationStatusEntrySchema.safeParse({
        ...VALID_STATUS_VALUE,
        citations: [{ sourceId: "x", title: "x", url: "x", resolvedAt: "x" }],
      }).success,
    ).toBe(false);
  });

  it("closes the degradation-reason set", () => {
    expect(LocationStatusReasonSchema.safeParse("no-adapter").success).toBe(true);
    expect(LocationStatusReasonSchema.safeParse("no-value-channel").success).toBe(true);
    expect(LocationStatusReasonSchema.safeParse("fetch-failed").success).toBe(true);
    expect(LocationStatusReasonSchema.safeParse("stale").success).toBe(false);
  });
});

describe("D1: board + list responses", () => {
  it("accepts a status-board response (scope echo + uncited statuses + warnings)", () => {
    expect(
      StatusBoardResponseSchema.safeParse({
        situation: {
          landingZoneIds: ["awsf"],
          origin: "by-reference",
          appId: "app-fictional-orion",
        },
        statuses: [VALID_STATUS_VALUE, VALID_STATUS_POINTER],
        warnings: [],
      }).success,
    ).toBe(true);
  });

  it("accepts a location list response", () => {
    expect(LocationListResponseSchema.safeParse({ locations: [VALID_RECORD] }).success).toBe(true);
  });

  it("accepts a registration mutation response (record + warnings)", () => {
    expect(
      LocationRegistrationResponseSchema.safeParse({ location: VALID_RECORD, warnings: [] })
        .success,
    ).toBe(true);
  });
});
