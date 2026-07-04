/**
 * D1 — consumer-state schema contracts (Step 3, locked decision 1: mid-level §1,
 * P26/M11). `AppRecordSchema`, `AppManifestSchema`, and the request schemas
 * accept the documented shapes and reject structural invalidity (empty
 * name/zones, unknown fields, caller-supplied `origin`/`id`).
 *
 * These use `safeParse(...).success` rather than `.parse(...).toThrow()` so the
 * ACCEPT cases are red until Batch 1 lands the real zod shapes (the Batch-0
 * stubs throw on any parse) and go green only when the schema exists — red for
 * behavioral reasons, exactly as the frozen-suite discipline requires. All data
 * is fictional (public-safe).
 */
import { describe, expect, it } from "vitest";
import {
  AppManifestSchema,
  AppRecordSchema,
  AppRegistrationRequestSchema,
  AppUpdateRequestSchema,
} from "./src/index";

const VALID_RECORD = {
  id: "app-fictional-orion",
  name: "Orion Checkout",
  landingZoneIds: ["awsf", "azure"],
  serviceSlugs: ["aws/textract"],
  origin: "self-declared",
  declaredAt: "2026-07-04T00:00:00.000Z",
  updatedAt: "2026-07-04T00:00:00.000Z",
};

const VALID_MANIFEST = {
  name: "Orion Checkout",
  landingZones: ["awsf", "azure"],
  services: ["aws/textract"],
  appId: "app-fictional-orion",
};

describe("D1: AppRecordSchema", () => {
  it("accepts a full valid record (P26 set shape)", () => {
    expect(AppRecordSchema.safeParse(VALID_RECORD).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(AppRecordSchema.safeParse({ ...VALID_RECORD, name: "" }).success).toBe(false);
  });

  it("rejects an empty landing-zone set (P26: at least one member)", () => {
    expect(AppRecordSchema.safeParse({ ...VALID_RECORD, landingZoneIds: [] }).success).toBe(false);
  });

  it("rejects an unknown origin value", () => {
    expect(AppRecordSchema.safeParse({ ...VALID_RECORD, origin: "discovered" }).success).toBe(
      false,
    );
  });

  it("accepts the registry origin from day one (the P17 in-place upgrade seat)", () => {
    expect(AppRecordSchema.safeParse({ ...VALID_RECORD, origin: "registry" }).success).toBe(true);
  });

  it("rejects an unknown field (strict — no identity fields ride the record)", () => {
    expect(
      AppRecordSchema.safeParse({ ...VALID_RECORD, ownerPrincipal: "user@example.com" }).success,
    ).toBe(false);
  });
});

describe("D1: AppManifestSchema", () => {
  it("accepts a full manifest and a minimal one (name + zones only)", () => {
    expect(AppManifestSchema.safeParse(VALID_MANIFEST).success).toBe(true);
    expect(AppManifestSchema.safeParse({ name: "Solo", landingZones: ["awsf"] }).success).toBe(
      true,
    );
  });

  it("rejects an empty landing-zone set", () => {
    expect(AppManifestSchema.safeParse({ name: "Solo", landingZones: [] }).success).toBe(false);
  });

  it("rejects an unknown field (the spec is frozen into team repos)", () => {
    expect(AppManifestSchema.safeParse({ ...VALID_MANIFEST, secretToken: "nope" }).success).toBe(
      false,
    );
  });
});

describe("D1: AppRegistrationRequestSchema", () => {
  it("accepts a valid registration (server owns id + origin)", () => {
    expect(
      AppRegistrationRequestSchema.safeParse({
        name: "Orion Checkout",
        landingZoneIds: ["awsf"],
        serviceSlugs: ["aws/textract"],
      }).success,
    ).toBe(true);
  });

  it("accepts an omitted serviceSlugs (empty is legal)", () => {
    expect(
      AppRegistrationRequestSchema.safeParse({ name: "Orion", landingZoneIds: ["awsf"] }).success,
    ).toBe(true);
  });

  it("rejects a caller-supplied origin (origin is server-set, never by the caller)", () => {
    expect(
      AppRegistrationRequestSchema.safeParse({
        name: "Orion",
        landingZoneIds: ["awsf"],
        origin: "registry",
      }).success,
    ).toBe(false);
  });

  it("rejects a caller-supplied id (id is server-generated)", () => {
    expect(
      AppRegistrationRequestSchema.safeParse({
        id: "app-forged",
        name: "Orion",
        landingZoneIds: ["awsf"],
      }).success,
    ).toBe(false);
  });

  it("rejects empty name and empty zone set (structural invalidity → 400 at the route)", () => {
    expect(
      AppRegistrationRequestSchema.safeParse({ name: "", landingZoneIds: ["awsf"] }).success,
    ).toBe(false);
    expect(
      AppRegistrationRequestSchema.safeParse({ name: "Orion", landingZoneIds: [] }).success,
    ).toBe(false);
  });
});

describe("D1: AppUpdateRequestSchema", () => {
  it("accepts a partial update (a single mutable field)", () => {
    expect(AppUpdateRequestSchema.safeParse({ name: "Renamed" }).success).toBe(true);
    expect(AppUpdateRequestSchema.safeParse({ landingZoneIds: ["azure"] }).success).toBe(true);
  });

  it("rejects an empty patch (at least one field required)", () => {
    expect(AppUpdateRequestSchema.safeParse({}).success).toBe(false);
  });

  it("rejects an unknown / immutable field (no origin, no id in a patch)", () => {
    expect(AppUpdateRequestSchema.safeParse({ origin: "registry" }).success).toBe(false);
  });
});
