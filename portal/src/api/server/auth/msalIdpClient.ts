import { ConfidentialClientApplication, type Configuration } from "@azure/msal-node";
import { IdentityConfigError, type EntraConfig, type IdentityClaims } from "@atlas/context-layer";

import { AuthStateError, type AcquiredIdentity, type IdpClient } from "./bff";

/**
 * The production {@link IdpClient} — MSAL Node confidential client (auth-code + PKCE +
 * `response_mode=form_post`, certificate credential; locked decision 1/5). It is company-
 * side by construction: the public repo never wires a real tenant (ADR-0004), so this path
 * is NOT exercised by tests — the E2 round-trip runs against a mock {@link IdpClient}. Kept
 * real so the wiring is correct on import.
 *
 * Local-dev risk 2: MSAL Node uses its OWN HTTP client (not `globalThis.fetch`), so an MSW
 * Seam-A mock would NOT intercept its token exchange — which is exactly why the testable BFF
 * seam is the `IdpClient` interface, not the network. MSAL manages the refresh token inside
 * its token cache; we serialize that cache as the session's refresh material (decision 7:
 * refresh only — no Context-API access token is stored).
 */

const SCOPES = ["openid", "profile", "offline_access"];

export function createMsalIdpClient(config: EntraConfig): IdpClient {
  // Fail loud when the certificate credential is missing (E6 posture): a real-tenant deploy
  // that boots without cert material passes `assertIdentityEnvConsistent` but would otherwise
  // die at the FIRST login with an opaque MSAL error. Naming the vars makes it diagnosable.
  const missing = [
    ...(config.clientCert ? [] : ["ENTRA_CLIENT_CERT"]),
    ...(config.clientCertThumbprint ? [] : ["ENTRA_CLIENT_CERT_THUMBPRINT"]),
  ];
  if (missing.length > 0) {
    throw new IdentityConfigError(
      `Entra confidential-client certificate is incomplete: missing [${missing.join(", ")}]. ` +
        `Set both ENTRA_CLIENT_CERT (private key) and ENTRA_CLIENT_CERT_THUMBPRINT ` +
        `(PROD: Secrets Manager) — MSAL cannot acquire a token without the certificate credential.`,
    );
  }
  const msalConfig: Configuration = {
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      clientCertificate: {
        // Threaded through EntraConfig (read from ENTRA_CLIENT_CERT_THUMBPRINT), not a raw
        // process.env read at call depth. Both are asserted present above.
        thumbprintSha256: config.clientCertThumbprint!,
        privateKey: config.clientCert!,
      },
    },
  };
  const cca = new ConfidentialClientApplication(msalConfig);

  return {
    async authCodeUrl({ state, nonce, codeChallenge }) {
      return cca.getAuthCodeUrl({
        scopes: SCOPES,
        redirectUri: config.redirectUri,
        responseMode: "form_post",
        codeChallenge,
        codeChallengeMethod: "S256",
        state,
        nonce,
      });
    },
    async acquireTokenByCode({ code, codeVerifier, nonce }): Promise<AcquiredIdentity> {
      const result = await cca.acquireTokenByCode({
        scopes: SCOPES,
        redirectUri: config.redirectUri,
        code,
        codeVerifier,
      });
      const rawClaims = (result.idTokenClaims ?? {}) as Record<string, unknown>;
      // nonce replay defence (R12): the id_token nonce MUST equal the transaction nonce.
      if (rawClaims.nonce !== nonce) {
        throw new AuthStateError("id_token nonce mismatch — possible replay; login rejected.");
      }
      const claims = toIdentityClaims(rawClaims, config);
      const expiresAt = result.expiresOn ? result.expiresOn.getTime() : Date.now() + 3_600_000;
      // MSAL keeps the refresh token in its cache; persist ONLY the refresh material
      // (decision 7: id_token claims + refresh token only — never access-token material).
      const refreshToken = stripToRefreshMaterial(cca.getTokenCache().serialize());
      return { claims, ...(refreshToken ? { refreshToken } : {}), expiresAt };
    },
  };
}

/** MSAL serialized-cache sections that carry access-token material (decision 7: NEVER stored). */
const ACCESS_TOKEN_SECTIONS = ["AccessToken", "IdToken"] as const;
/** Sections kept for a later silent refresh — no access-token material among them. */
const REFRESH_MATERIAL_SECTIONS = ["RefreshToken", "Account", "AppMetadata"] as const;

/**
 * Reduce MSAL's serialized token cache to refresh material ONLY (locked decision 7: the
 * session persists id_token claims + refresh token, never an access token). MSAL's serialized
 * cache JSON groups entries under top-level sections (`AccessToken`, `IdToken`, `RefreshToken`,
 * `Account`, `AppMetadata`); this keeps the sections a silent refresh needs (`RefreshToken`,
 * `Account`, `AppMetadata`) and explicitly DROPS the access-token sections, so no access-token
 * material is ever written to the session store under the `refreshToken` field.
 *
 * Malformed JSON ⇒ `undefined` (store no refresh material), never the raw blob.
 */
export function stripToRefreshMaterial(serialized: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  const source = parsed as Record<string, unknown>;
  const kept: Record<string, unknown> = {};
  for (const section of REFRESH_MATERIAL_SECTIONS) {
    if (section in source) {
      kept[section] = source[section];
    }
  }
  // Belt-and-braces: the access-token sections are never copied above, but assert intent.
  for (const section of ACCESS_TOKEN_SECTIONS) {
    delete kept[section];
  }
  return JSON.stringify(kept);
}

function toIdentityClaims(raw: Record<string, unknown>, config: EntraConfig): IdentityClaims {
  const subject =
    (typeof raw.oid === "string" && raw.oid) || (typeof raw.sub === "string" && raw.sub) || "";
  const name =
    (typeof raw.name === "string" && raw.name) ||
    (typeof raw.preferred_username === "string" && raw.preferred_username) ||
    undefined;
  return {
    subject,
    ...(name ? { name } : {}),
    roles: Array.isArray(raw.roles)
      ? raw.roles.filter((role): role is string => typeof role === "string")
      : [],
    issuer: typeof raw.iss === "string" ? raw.iss : config.authority,
    audience: typeof raw.aud === "string" ? raw.aud : config.apiAudience,
    ...(typeof raw.tid === "string" ? { tenantId: raw.tid } : {}),
  };
}
