/**
 * E1 — identity as the FIRST factory input (I2). Validated claims → verified APP set (axis 2)
 * via the directory port's `resolveMembership`, seated on `ctx.verifiedApps` (app-id strings
 * only, identity-light); the principal is emitted SEPARATELY to the consumer-state sink and
 * never rides the context. Fail-closed: the self-declared default resolves NO membership.
 */
import { describe, expect, it, vi } from "vitest";

import type { IdentityClaims } from "../identity/claims";
import {
  createMockRegistryAppsAdapter,
  mockRegistryAppsAdapter,
} from "../repositories/registryAppsAdapter";
import { createResolutionContext } from "./createResolutionContext";

const CLAIMS: IdentityClaims = {
  subject: "fictional-user-oid",
  name: "Fictional Operator",
  roles: ["app.orion.member"],
  issuer: "https://mock-issuer.example/v2.0",
  audience: "api://atlas-context",
  tenantId: "tenant-fictional",
};

describe("createResolutionContext — identity input (E1, I2)", () => {
  it("claims → verified APP set via the mock registry adapter, seated on ctx.verifiedApps", async () => {
    const ctx = await createResolutionContext({
      identity: { claims: CLAIMS },
      appDirectory: mockRegistryAppsAdapter,
      env: {},
    });

    // `app.orion.member` maps to the fictional Orion APP (membershipSource:"entra").
    expect(ctx.verifiedApps).toEqual(["registry-app-orion"]);
  });

  it("emits the principal SEPARATELY to the consumer-state sink; the ctx stays identity-light", async () => {
    const onPrincipal = vi.fn();
    const ctx = await createResolutionContext({
      identity: { claims: CLAIMS },
      appDirectory: mockRegistryAppsAdapter,
      onPrincipal,
      env: {},
    });

    expect(onPrincipal).toHaveBeenCalledTimes(1);
    expect(onPrincipal).toHaveBeenCalledWith({
      subject: "fictional-user-oid",
      name: "Fictional Operator",
    });
    // Identity-light (I2): NO raw principal rides the context — only the vetted app-id set.
    expect(ctx).not.toHaveProperty("subject");
    expect(ctx).not.toHaveProperty("principal");
    expect(ctx).not.toHaveProperty("claims");
    expect(ctx.token).toBeUndefined();
  });

  it("fail-closed: the self-declared default resolves NO membership even with valid claims", async () => {
    // The default appDirectory (self-declared adapter) implements no `resolveMembership`.
    const ctx = await createResolutionContext({ identity: { claims: CLAIMS }, env: {} });
    expect(ctx.verifiedApps).toEqual([]);
  });

  it("no claims ⇒ empty verified set (anonymous, fail-closed)", async () => {
    const ctx = await createResolutionContext({
      appDirectory: mockRegistryAppsAdapter,
      env: {},
    });
    expect(ctx.verifiedApps).toEqual([]);
  });

  it("only the caller's granted roles resolve — an unknown role grants nothing", async () => {
    const adapter = createMockRegistryAppsAdapter();
    const ctx = await createResolutionContext({
      identity: { claims: { ...CLAIMS, roles: ["app.unknown.role"] } },
      appDirectory: adapter,
      env: {},
    });
    expect(ctx.verifiedApps).toEqual([]);
  });
});
