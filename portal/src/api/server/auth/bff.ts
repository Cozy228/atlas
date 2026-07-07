import { createHash, randomBytes } from "node:crypto";

import type { IdentityClaims, SessionRecord, SessionStore } from "@atlas/context-layer";

/**
 * The BFF auth-code state machine (WS1), factored OUT of the Nitro routes so the E2
 * login/callback/logout round-trip is provable locally against a mock IdP with ZERO tenant.
 * MSAL (the untestable-without-network confidential client) sits behind {@link IdpClient};
 * the state machine — PKCE, `state` CSRF, `nonce` replay defence, session-id rotation, the
 * claims+refresh-only session record (decision 7) — is pure and injectable.
 *
 * OIDC hardening (R12): `state` AND `nonce` are BOTH validated — PKCE covers neither
 * (it binds the code to the client, not the browser session, and does not defend the
 * id_token against replay). `state` is checked here (CSRF); `nonce` is checked by the
 * IdP client against the returned id_token.
 */
export interface IdpClient {
  /** Build the authorization-code redirect URL — PKCE (`codeChallenge`), `state`, `nonce`,
   *  `response_mode=form_post`. */
  authCodeUrl(params: { state: string; nonce: string; codeChallenge: string }): Promise<string>;
  /** Exchange the code for tokens; MUST validate the id_token `nonce` against the supplied
   *  value and reject on mismatch; returns the vetted claims + refresh token (no access
   *  token — decision 7). */
  acquireTokenByCode(params: {
    code: string;
    codeVerifier: string;
    nonce: string;
  }): Promise<AcquiredIdentity>;
}

export type AcquiredIdentity = {
  claims: IdentityClaims;
  refreshToken?: string;
  /** Epoch ms the id_token expires (session TTL tracks it). */
  expiresAt: number;
};

/** Ephemeral pre-session state carried from `/auth/login` to `/auth/callback`. Stored in a
 *  signed, HttpOnly, short-lived cookie by the route; NEVER reused across logins. */
export type LoginTransaction = { state: string; nonce: string; codeVerifier: string };

/** Injectable randomness so a test can pin deterministic values. */
export type LoginGenerators = {
  state?: () => string;
  nonce?: () => string;
  codeVerifier?: () => string;
  sessionId?: () => string;
};

export class AuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthStateError";
  }
}

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/** RFC 7636 S256 PKCE challenge for a verifier. */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Begin login: mint `state` + `nonce` + a PKCE verifier, build the authorize URL, and hand
 * back the transaction the callback must reconcile against.
 */
export async function beginLogin(
  idp: IdpClient,
  generators: LoginGenerators = {},
): Promise<{ redirectUrl: string; transaction: LoginTransaction }> {
  const state = (generators.state ?? randomToken)();
  const nonce = (generators.nonce ?? randomToken)();
  const codeVerifier = (generators.codeVerifier ?? randomToken)();
  const redirectUrl = await idp.authCodeUrl({
    state,
    nonce,
    codeChallenge: pkceChallenge(codeVerifier),
  });
  return { redirectUrl, transaction: { state, nonce, codeVerifier } };
}

/**
 * Complete the callback (`response_mode=form_post`): validate `state` (CSRF), exchange the
 * code (the IdP client validates `nonce`), then create a session with a FRESH id (rotation
 * on login) holding claims + refresh token ONLY. Returns the new session id + its TTL.
 */
export async function completeCallback(
  deps: { idp: IdpClient; sessionStore: SessionStore; now?: () => number },
  input: {
    transaction: LoginTransaction;
    formState: string;
    code: string;
  },
  generators: LoginGenerators = {},
): Promise<{ sessionId: string; ttlSeconds: number }> {
  // `state` validation (R12): the value POSTed back must equal the one we minted. PKCE does
  // NOT cover this — a stolen code without the matching browser `state` is rejected here.
  if (!input.formState || input.formState !== input.transaction.state) {
    throw new AuthStateError("OAuth state mismatch — possible CSRF; login rejected.");
  }

  // Code exchange; the IdP client validates the id_token `nonce` against the transaction.
  const identity = await deps.idp.acquireTokenByCode({
    code: input.code,
    codeVerifier: input.transaction.codeVerifier,
    nonce: input.transaction.nonce,
  });

  // Session-id ROTATION on login (R6/E2): every successful login mints a brand-new id, so a
  // fixated pre-auth id can never be elevated to an authenticated session.
  const now = (deps.now ?? Date.now)();
  const sessionId = (generators.sessionId ?? randomToken)();
  const ttlSeconds = Math.max(1, Math.ceil((identity.expiresAt - now) / 1000));
  const record: SessionRecord = {
    claims: identity.claims,
    ...(identity.refreshToken ? { refreshToken: identity.refreshToken } : {}),
    createdAt: now,
    expiresAt: identity.expiresAt,
  };
  await deps.sessionStore.set(sessionId, record, ttlSeconds);
  return { sessionId, ttlSeconds };
}

/**
 * Logout = LOCAL session destruction ONLY (R12): drop the server-side record. NO Entra
 * front-channel / single-logout is initiated this slice.
 */
export async function destroySession(sessionStore: SessionStore, sessionId: string): Promise<void> {
  await sessionStore.destroy(sessionId);
}
