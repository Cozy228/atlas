import {
  createSessionStore,
  readEntraConfig,
  readSessionConfig,
  sharedSessionStore,
  type EntraConfig,
  type IdentityClaims,
  type SessionConfig,
  type SessionStore,
} from "@atlas/context-layer";

import { createMsalIdpClient } from "./msalIdpClient";
import type { IdpClient } from "./bff";
import { readSessionCookie, verifySessionId } from "./sessionCookie";

/**
 * Assembled BFF auth dependencies. `undefined` when Entra is not configured — the auth
 * routes then respond honestly "not enabled" rather than half-running (E6). A half-set env
 * throws loud inside `readEntraConfig`/`readSessionConfig` before we get here.
 */
export type AuthContext = {
  entra: EntraConfig;
  session: SessionConfig;
  sessionStore: SessionStore;
  idp: IdpClient;
};

function readProcessEnv(): Record<string, string | undefined> {
  return process.env as Record<string, string | undefined>;
}

/**
 * Load the auth context from env, or `undefined` when Entra is unset. `overrides` lets a
 * test inject a mock {@link IdpClient} + an in-memory {@link SessionStore} so the E2 route
 * round-trip runs with ZERO tenant.
 */
export async function loadAuthContext(overrides?: {
  env?: Record<string, string | undefined>;
  idp?: IdpClient;
  sessionStore?: SessionStore;
}): Promise<AuthContext | undefined> {
  const env = overrides?.env ?? readProcessEnv();
  const entra = readEntraConfig(env);
  if (!entra) {
    return undefined;
  }
  const session = readSessionConfig(env, entra);
  if (!session) {
    return undefined;
  }
  const sessionStore = overrides?.sessionStore ?? (await sharedSessionStore(env, session));
  const idp = overrides?.idp ?? createMsalIdpClient(entra);
  return { entra, session, sessionStore, idp };
}

/**
 * Resolve the BROWSER surface's identity from the session COOKIE ONLY (confused-deputy R7):
 * verify the signed session id, look the record up in the store, return its claims. A
 * `Bearer` header is NEVER consulted on the browser surface. Absent/invalid cookie or
 * expired session ⇒ `undefined` (anonymous ⇒ app Sources fail-closed).
 */
export async function resolveBrowserClaims(
  cookieHeader: string | undefined | null,
  ctx: { session: SessionConfig; sessionStore: SessionStore },
  env: Record<string, string | undefined> = readProcessEnv(),
): Promise<IdentityClaims | undefined> {
  const signed = readSessionCookie(cookieHeader, env);
  if (!signed) {
    return undefined;
  }
  const sessionId = verifySessionId(signed, ctx.session.secret);
  if (!sessionId) {
    return undefined;
  }
  const record = await ctx.sessionStore.get(sessionId);
  return record?.claims;
}

/** Convenience for the composition default (non-injected) session store. */
export function defaultSessionStore(
  env: Record<string, string | undefined>,
  session: SessionConfig,
): Promise<SessionStore> {
  return createSessionStore(env, session);
}
