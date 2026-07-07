/**
 * E6 — env wiring: half-set `ENTRA_*`/`SESSION_*` fails loud; fully-unset runs anonymous.
 */
import { describe, expect, it } from "vitest";

import {
  IdentityConfigError,
  assertIdentityEnvConsistent,
  readEntraConfig,
  readSessionConfig,
} from "./entraConfig";

const FULL = {
  ENTRA_TENANT_ID: "tenant-fictional",
  ENTRA_CLIENT_ID: "client-fictional",
  ENTRA_AUTHORITY: "https://mock-issuer.example/tenant-fictional",
  ENTRA_API_AUDIENCE: "api://atlas-context",
  ENTRA_REDIRECT_URI: "https://portal.example/auth/callback",
} as const;

describe("readEntraConfig (E6)", () => {
  it("fully unset ⇒ undefined (anonymous posture)", () => {
    expect(readEntraConfig({})).toBeUndefined();
  });

  it("all five set ⇒ a config", () => {
    const config = readEntraConfig({ ...FULL });
    expect(config).toMatchObject({
      tenantId: "tenant-fictional",
      clientId: "client-fictional",
      apiAudience: "api://atlas-context",
    });
  });

  it("half-set ⇒ loud throw naming the missing vars", () => {
    const { ENTRA_REDIRECT_URI: _omit, ...half } = FULL;
    expect(() => readEntraConfig(half)).toThrow(IdentityConfigError);
    expect(() => readEntraConfig(half)).toThrow(/ENTRA_REDIRECT_URI/);
  });

  it("a blank value counts as absent (half-set throws)", () => {
    expect(() => readEntraConfig({ ...FULL, ENTRA_CLIENT_ID: "   " })).toThrow(IdentityConfigError);
  });
});

describe("readSessionConfig (E6)", () => {
  it("Entra unset ⇒ session irrelevant (undefined)", () => {
    expect(readSessionConfig({}, undefined)).toBeUndefined();
  });

  it("Entra set but SESSION_SECRET missing ⇒ loud throw", () => {
    const entra = readEntraConfig({ ...FULL })!;
    expect(() => readSessionConfig({ ...FULL }, entra)).toThrow(IdentityConfigError);
  });

  it("Entra + SESSION_SECRET ⇒ config; SESSION_VALKEY_URL falls back to CACHE_VALKEY_URL", () => {
    const entra = readEntraConfig({ ...FULL })!;
    const session = readSessionConfig(
      { ...FULL, SESSION_SECRET: "signing-key", CACHE_VALKEY_URL: "rediss://cache.example:6379" },
      entra,
    );
    expect(session).toEqual({ secret: "signing-key", valkeyUrl: "rediss://cache.example:6379" });
  });

  it("production + no Valkey URL ⇒ loud throw (would split sessions per ECS task)", () => {
    const entra = readEntraConfig({ ...FULL })!;
    expect(() =>
      readSessionConfig({ ...FULL, SESSION_SECRET: "signing-key", NODE_ENV: "production" }, entra),
    ).toThrow(IdentityConfigError);
    expect(() =>
      readSessionConfig({ ...FULL, SESSION_SECRET: "signing-key", NODE_ENV: "production" }, entra),
    ).toThrow(/SESSION_VALKEY_URL|CACHE_VALKEY_URL/);
  });

  it("production + Valkey URL ⇒ config (no throw)", () => {
    const entra = readEntraConfig({ ...FULL })!;
    const session = readSessionConfig(
      {
        ...FULL,
        SESSION_SECRET: "signing-key",
        NODE_ENV: "production",
        SESSION_VALKEY_URL: "rediss://session.example:6379",
      },
      entra,
    );
    expect(session).toEqual({ secret: "signing-key", valkeyUrl: "rediss://session.example:6379" });
  });

  it("non-production + no Valkey URL ⇒ in-memory fallback (no throw)", () => {
    const entra = readEntraConfig({ ...FULL })!;
    const session = readSessionConfig({ ...FULL, SESSION_SECRET: "signing-key" }, entra);
    expect(session).toEqual({ secret: "signing-key" });
  });
});

describe("assertIdentityEnvConsistent (E6)", () => {
  it("no-op when fully unset (anonymous is legal)", () => {
    expect(() => assertIdentityEnvConsistent({})).not.toThrow();
  });

  it("throws on a half-set identity", () => {
    const { ENTRA_AUTHORITY: _omit, ...half } = FULL;
    expect(() => assertIdentityEnvConsistent(half)).toThrow(IdentityConfigError);
  });

  it("throws when Entra is complete but SESSION_SECRET is absent", () => {
    expect(() => assertIdentityEnvConsistent({ ...FULL })).toThrow(IdentityConfigError);
  });
});
