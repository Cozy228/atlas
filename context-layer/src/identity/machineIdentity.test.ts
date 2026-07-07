/**
 * E3 (machine side) — the machine surface derives identity from the Authorization Bearer
 * ONLY (confused-deputy R7). `resolveMachineClaims` takes a bearer + env; it has no cookie
 * input by construction. Env-gated (unset ⇒ anonymous) and ignore-don't-reject (an invalid
 * token yields no identity, never a throw).
 */
import { describe, expect, it, vi } from "vitest";

import type { IdentityClaims } from "./claims";
import { resolveMachineClaims } from "./machineIdentity";

const ENTRA_ENV = {
  ENTRA_TENANT_ID: "tenant-fictional",
  ENTRA_CLIENT_ID: "client-fictional",
  ENTRA_AUTHORITY: "https://mock-issuer.example/tenant-fictional",
  ENTRA_API_AUDIENCE: "api://atlas-context",
  ENTRA_REDIRECT_URI: "https://portal.example/auth/callback",
} as const;

const claimsFrom = (token: string): IdentityClaims => ({
  subject: `subject-of-${token}`,
  roles: ["app.orion.member"],
  issuer: "https://mock-issuer.example/tenant-fictional",
  audience: "api://atlas-context",
});

describe("resolveMachineClaims (E3, machine = Bearer-only)", () => {
  it("Entra unset ⇒ undefined even with a Bearer (anonymous posture, E6)", async () => {
    const validate = vi.fn(async (token: string) => claimsFrom(token));
    expect(await resolveMachineClaims("any-token", {}, validate)).toBeUndefined();
    expect(validate).not.toHaveBeenCalled();
  });

  it("identity derives from the BEARER argument (there is no cookie input)", async () => {
    const validate = vi.fn(async (token: string) => claimsFrom(token));
    const claims = await resolveMachineClaims("machine-token", ENTRA_ENV, validate);
    expect(claims?.subject).toBe("subject-of-machine-token");
  });

  it("no Bearer ⇒ undefined (nothing to derive from)", async () => {
    const validate = vi.fn(async (token: string) => claimsFrom(token));
    expect(await resolveMachineClaims(undefined, ENTRA_ENV, validate)).toBeUndefined();
    expect(validate).not.toHaveBeenCalled();
  });

  it("ignore-don't-reject: an invalid token yields no identity, never throws (R7)", async () => {
    const validate = vi.fn(async () => {
      throw new Error("bad token");
    });
    await expect(resolveMachineClaims("foreign", ENTRA_ENV, validate)).resolves.toBeUndefined();
  });
});
