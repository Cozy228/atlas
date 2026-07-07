/**
 * FINDING 5 — the MSAL confidential client must fail LOUD when the certificate credential is
 * incomplete (E6 posture). A real-tenant deploy missing cert material passes
 * `assertIdentityEnvConsistent` at boot; without this guard it would die at the first login
 * with an opaque MSAL error instead of a diagnosable config error. The throw happens BEFORE
 * any MSAL construction, so no real PEM is needed to exercise it.
 */
import { describe, expect, it } from "vitest";
import { IdentityConfigError, type EntraConfig } from "@atlas/context-layer";

import { createMsalIdpClient, stripToRefreshMaterial } from "./msalIdpClient";

const BASE: EntraConfig = {
  tenantId: "tenant-fictional",
  clientId: "client-fictional",
  authority: "https://mock-issuer.example/tenant-fictional",
  apiAudience: "api://atlas-context",
  redirectUri: "https://portal.example/auth/callback",
};

describe("createMsalIdpClient certificate guard (E6)", () => {
  it("throws IdentityConfigError when ENTRA_CLIENT_CERT is missing", () => {
    expect(() => createMsalIdpClient({ ...BASE, clientCertThumbprint: "AABBCC" })).toThrow(
      IdentityConfigError,
    );
    expect(() => createMsalIdpClient({ ...BASE, clientCertThumbprint: "AABBCC" })).toThrow(
      /ENTRA_CLIENT_CERT/,
    );
  });

  it("throws IdentityConfigError when ENTRA_CLIENT_CERT_THUMBPRINT is missing", () => {
    expect(() =>
      createMsalIdpClient({ ...BASE, clientCert: "-----BEGIN PRIVATE KEY-----" }),
    ).toThrow(/ENTRA_CLIENT_CERT_THUMBPRINT/);
  });

  it("names BOTH vars when neither is set", () => {
    let caught: unknown;
    try {
      createMsalIdpClient(BASE);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(IdentityConfigError);
    const message = (caught as Error).message;
    expect(message).toContain("ENTRA_CLIENT_CERT");
    expect(message).toContain("ENTRA_CLIENT_CERT_THUMBPRINT");
  });
});

describe("stripToRefreshMaterial (decision 7 — no access-token material stored)", () => {
  // A crafted MSAL-shaped serialized cache with all four sections present.
  const SERIALIZED_CACHE = JSON.stringify({
    AccessToken: {
      "uid.utid-login.example-accesstoken-client-tenant-scope": {
        secret: "ACCESS-TOKEN-SECRET-must-not-persist",
        credentialType: "AccessToken",
      },
    },
    IdToken: {
      "uid.utid-login.example-idtoken-client-tenant": {
        secret: "ID-TOKEN-SECRET-must-not-persist",
        credentialType: "IdToken",
      },
    },
    RefreshToken: {
      "uid.utid-login.example-refreshtoken-client": {
        secret: "REFRESH-TOKEN-SECRET-keep-this",
        credentialType: "RefreshToken",
      },
    },
    Account: { "uid.utid-login.example-tenant": { homeAccountId: "uid.utid" } },
    AppMetadata: { "appmetadata-login.example-client": { clientId: "client" } },
  });

  it("keeps RefreshToken/Account/AppMetadata and drops AccessToken/IdToken", () => {
    const stripped = stripToRefreshMaterial(SERIALIZED_CACHE);
    expect(stripped).toBeDefined();
    const parsed = JSON.parse(stripped!);
    expect(parsed).toHaveProperty("RefreshToken");
    expect(parsed).toHaveProperty("Account");
    expect(parsed).toHaveProperty("AppMetadata");
    expect(parsed).not.toHaveProperty("AccessToken");
    expect(parsed).not.toHaveProperty("IdToken");
    // No access-token/id-token secret survives anywhere in the serialized material.
    expect(stripped).not.toContain("ACCESS-TOKEN-SECRET");
    expect(stripped).not.toContain("ID-TOKEN-SECRET");
    expect(stripped).toContain("REFRESH-TOKEN-SECRET");
  });

  it("malformed JSON ⇒ undefined (store nothing, never the raw blob)", () => {
    expect(stripToRefreshMaterial("not-json{")).toBeUndefined();
    expect(stripToRefreshMaterial("")).toBeUndefined();
    expect(stripToRefreshMaterial("42")).toBeUndefined();
  });
});
