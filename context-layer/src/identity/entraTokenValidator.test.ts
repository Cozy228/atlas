/**
 * E1 — machine-surface JWKS validation (WS2). A self-signed JWKS (jose, ZERO tenant)
 * exercises the FULL validate path: signature, `iss`, `aud`, `roles`, expiry. Parameterized
 * issuer/JWKS/audience — no `login.microsoftonline.com` anywhere.
 */
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWTVerifyGetKey } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { EntraTokenError, validateEntraToken } from "./entraTokenValidator";

const ISSUER = "https://mock-issuer.example/tenant-fictional/v2.0";
const AUDIENCE = "api://atlas-context";

let signingKey: CryptoKey;
let jwks: JWTVerifyGetKey;
let foreignKey: CryptoKey;

async function mintToken(
  claims: Record<string, unknown>,
  overrides: { issuer?: string; audience?: string; expiresIn?: string; key?: CryptoKey } = {},
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "mock-key-1" })
    .setIssuer(overrides.issuer ?? ISSUER)
    .setAudience(overrides.audience ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? "5m")
    .sign(overrides.key ?? signingKey);
}

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  signingKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwks = createLocalJWKSet({ keys: [{ ...jwk, kid: "mock-key-1", alg: "RS256", use: "sig" }] });
  foreignKey = (await generateKeyPair("RS256", { extractable: true })).privateKey;
});

describe("validateEntraToken (E1)", () => {
  it("accepts a well-formed token and maps claims (subject/name/roles/aud/iss/tenant)", async () => {
    const token = await mintToken({
      oid: "fictional-user-oid",
      name: "Fictional Operator",
      roles: ["app.orion.member", "app.lyra.member"],
      tid: "tenant-fictional",
    });

    const claims = await validateEntraToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks });

    expect(claims.subject).toBe("fictional-user-oid");
    expect(claims.name).toBe("Fictional Operator");
    expect(claims.roles).toEqual(["app.orion.member", "app.lyra.member"]);
    expect(claims.audience).toBe(AUDIENCE);
    expect(claims.issuer).toBe(ISSUER);
    expect(claims.tenantId).toBe("tenant-fictional");
  });

  it("falls back to `sub` when `oid` is absent, and empty roles when none present", async () => {
    const token = await mintToken({ sub: "fictional-sub" });
    const claims = await validateEntraToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks });
    expect(claims.subject).toBe("fictional-sub");
    expect(claims.roles).toEqual([]);
  });

  it("rejects a wrong audience", async () => {
    const token = await mintToken({ oid: "u", audience: "api://someone-else" } as never, {
      audience: "api://someone-else",
    });
    await expect(
      validateEntraToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks }),
    ).rejects.toBeInstanceOf(EntraTokenError);
  });

  it("rejects a wrong issuer", async () => {
    const token = await mintToken({ oid: "u" }, { issuer: "https://evil-issuer.example/v2.0" });
    await expect(
      validateEntraToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks }),
    ).rejects.toBeInstanceOf(EntraTokenError);
  });

  it("rejects a token signed by a key not in the JWKS (tampered signature)", async () => {
    const token = await mintToken({ oid: "u" }, { key: foreignKey });
    await expect(
      validateEntraToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks }),
    ).rejects.toBeInstanceOf(EntraTokenError);
  });

  it("rejects an expired token", async () => {
    const token = await mintToken({ oid: "u" }, { expiresIn: "-1m" });
    await expect(
      validateEntraToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks }),
    ).rejects.toBeInstanceOf(EntraTokenError);
  });

  it("rejects a token with no subject claim (no oid/sub)", async () => {
    const token = await mintToken({ roles: [] });
    await expect(
      validateEntraToken(token, { issuer: ISSUER, audience: AUDIENCE, jwks }),
    ).rejects.toBeInstanceOf(EntraTokenError);
  });
});
