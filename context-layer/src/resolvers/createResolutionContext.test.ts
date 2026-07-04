/**
 * D6/D7/D8 — factory scope vetting (Step 1, M11 + P26). Warning codes are
 * asserted as runtime strings on purpose: the `scope_drift` /
 * `scope_unresolved` vocabulary lands in the schema warning union in Batch 1,
 * and this frozen suite must typecheck against today's untouched unions.
 */
import { describe, expect, it, vi } from "vitest";

import {
  createResolutionContext,
  nullAppDirectoryAdapter,
  type AppDirectoryPort,
} from "./createResolutionContext";

function warningCodesOf(ctx: { warnings: ReadonlyArray<{ code: string }> }): string[] {
  return ctx.warnings.map((warning) => String(warning.code));
}

describe("createResolutionContext — the governance gate", () => {
  it("D6: by-value scope seats the P26 set shape verbatim and never touches the directory", async () => {
    const lookup = vi.fn(async () => null);
    const port: AppDirectoryPort = { lookup };

    const ctx = await createResolutionContext({
      scope: { kind: "by-value", landingZones: ["awsf"] },
      appDirectory: port,
      env: {},
    });

    expect(ctx.scope?.landingZoneIds).toEqual(["awsf"]);
    expect(ctx.scope?.origin).toBe("by-value");
    // M11: a by-value request NEVER writes. The port is lookup-only by
    // construction (writes are unrepresentable), and pure by-value must not
    // even consult it — zero port calls.
    expect(lookup).not.toHaveBeenCalled();
  });

  it("D6: by-reference with a resolving directory seats the declared set + origin by-reference", async () => {
    const lookup = vi.fn(async (appId: string) =>
      appId === "fictional-app-orion" ? { landingZoneIds: ["awsf", "azrf"] } : null,
    );

    const ctx = await createResolutionContext({
      scope: { kind: "by-reference", appId: "fictional-app-orion" },
      appDirectory: { lookup },
      env: {},
    });

    expect(ctx.scope?.landingZoneIds).toEqual(["awsf", "azrf"]);
    expect(ctx.scope?.appId).toBe("fictional-app-orion");
    expect(ctx.scope?.origin).toBe("by-reference");
    expect(ctx.warnings).toEqual([]);
  });

  it("D7: value + reference agreeing → no scope_drift (the warning fires on disagreement only)", async () => {
    const lookup = vi.fn(async () => ({ landingZoneIds: ["awsf"] }));

    const ctx = await createResolutionContext({
      scope: { kind: "both", landingZones: ["awsf"], appId: "fictional-app-orion" },
      appDirectory: { lookup },
      env: {},
    });

    expect(ctx.scope?.landingZoneIds).toEqual(["awsf"]);
    expect(warningCodesOf(ctx)).not.toContain("scope_drift");
  });

  it("D7: value + reference disagreeing → value wins, scope_drift appended, port lookup-only", async () => {
    const lookup = vi.fn(async (appId: string) =>
      appId === "fictional-app-orion" ? { landingZoneIds: ["azrf"] } : null,
    );
    const port: AppDirectoryPort = { lookup };

    const ctx = await createResolutionContext({
      scope: { kind: "both", landingZones: ["awsf"], appId: "fictional-app-orion" },
      appDirectory: port,
      env: {},
    });

    // M11 conflict rule: the caller's own freshest declaration (the value) wins.
    expect(ctx.scope?.landingZoneIds).toEqual(["awsf"]);
    expect(ctx.scope?.origin).toBe("by-value");
    expect(warningCodesOf(ctx)).toContain("scope_drift");
    // Read-only reconciliation: at most a lookup of the referenced record.
    expect(lookup).toHaveBeenCalledWith("fictional-app-orion");
  });

  it("D8: unknown appId by-reference → no app scope + scope_unresolved (honest-empty)", async () => {
    const ctx = await createResolutionContext({
      scope: { kind: "by-reference", appId: "fictional-app-unknown" },
      appDirectory: nullAppDirectoryAdapter,
      env: {},
    });

    expect(ctx.scope?.landingZoneIds ?? undefined).toBeUndefined();
    expect(ctx.scope?.appId ?? undefined).toBeUndefined();
    expect(warningCodesOf(ctx)).toContain("scope_unresolved");
  });

  it("D8: the null adapter is the Step-1 default — by-reference without a supplied port is honest-empty too", async () => {
    const ctx = await createResolutionContext({
      scope: { kind: "by-reference", appId: "fictional-app-unknown" },
      env: {},
    });

    expect(ctx.scope?.landingZoneIds ?? undefined).toBeUndefined();
    expect(warningCodesOf(ctx)).toContain("scope_unresolved");
  });

  it("D6: absent scope → anonymous unscoped context, empty warnings, usable fetch", async () => {
    const ctx = await createResolutionContext({ env: {} });

    expect(ctx.scope?.landingZoneIds ?? undefined).toBeUndefined();
    expect(ctx.scope?.appId ?? undefined).toBeUndefined();
    expect(ctx.warnings).toEqual([]);
    expect(typeof ctx.fetch).toBe("function");
    expect(ctx.token).toBeUndefined();
  });

  it("D6: identity.bearer seats ctx.token opaque and unparsed (ADR-0001)", async () => {
    const ctx = await createResolutionContext({
      identity: { bearer: "fictional-caller-token-123" },
      env: {},
    });

    expect(ctx.token).toBe("fictional-caller-token-123");
  });
});
