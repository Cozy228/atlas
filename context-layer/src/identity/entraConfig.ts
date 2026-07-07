/**
 * Entra / session env wiring (WS1/WS2; local-dev risk 4, E6). These vars are documented
 * in `portal/.env.example` but were consumed NOWHERE before this slice — inert. Wire them
 * with LOUD fail-on-half-set validation: a half-configured identity must crash honestly at
 * composition, never silently fall through to anonymous (which would be a fail-OPEN latent
 * bug when someone believes identity is on).
 *
 * Parameterized issuer/JWKS/authority (locked invariant): `ENTRA_AUTHORITY` is the base;
 * `login.microsoftonline.com` is NEVER hardcoded (testability + sovereign clouds + the
 * public-safe mock issuer).
 */

/** The five core Entra vars. Present-all ⇒ identity configured; present-some ⇒ loud throw;
 *  present-none ⇒ anonymous (undefined). */
export const ENTRA_CORE_VARS = [
  "ENTRA_TENANT_ID",
  "ENTRA_CLIENT_ID",
  "ENTRA_AUTHORITY",
  "ENTRA_API_AUDIENCE",
  "ENTRA_REDIRECT_URI",
] as const;

export type EntraConfig = {
  tenantId: string;
  clientId: string;
  /** Authority base — issuer/JWKS root. Parameterized; sovereign-cloud + mock-issuer safe. */
  authority: string;
  /** Expected `aud` on the machine surface (the Context-API resource). */
  apiAudience: string;
  /** BFF callback (`response_mode=form_post`). */
  redirectUri: string;
  /** Confidential-client certificate (BFF only; PROD via Secrets Manager). Optional here
   *  because a local mock-Entra run (Seam A) needs no real cert. */
  clientCert?: string;
  /** SHA-256 thumbprint of {@link clientCert} (MSAL confidential-client credential). Optional
   *  on the config for the same reason as `clientCert`; `createMsalIdpClient` requires BOTH
   *  and throws loud when either is missing (a real deploy must not boot half-credentialed). */
  clientCertThumbprint?: string;
};

export type SessionConfig = {
  /** Cookie signing key (PROD via Secrets Manager). */
  secret: string;
  /** Session store URL; falls back to the content cache's Valkey URL (distinct keyspace). */
  valkeyUrl?: string;
};

/** Thrown when identity env is partially set — the fail-loud signal (E6). */
export class IdentityConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IdentityConfigError";
  }
}

function presentVars(env: Record<string, string | undefined>): string[] {
  return ENTRA_CORE_VARS.filter((name) => {
    const value = env[name];
    return typeof value === "string" && value.trim().length > 0;
  });
}

/**
 * Read the Entra config, or `undefined` when identity is fully unset (anonymous posture).
 * Throws {@link IdentityConfigError} on a half-set — naming exactly which vars are missing,
 * so the misconfiguration is diagnosable from the log alone (E6).
 */
export function readEntraConfig(env: Record<string, string | undefined>): EntraConfig | undefined {
  const present = presentVars(env);
  if (present.length === 0) {
    return undefined;
  }
  if (present.length < ENTRA_CORE_VARS.length) {
    const missing = ENTRA_CORE_VARS.filter((name) => !present.includes(name));
    throw new IdentityConfigError(
      `Entra identity is half-configured: set [${present.join(", ")}] but missing ` +
        `[${missing.join(", ")}]. Configure ALL of {${ENTRA_CORE_VARS.join(", ")}} or NONE ` +
        `(a half-set identity must not silently run anonymous).`,
    );
  }
  return {
    tenantId: env.ENTRA_TENANT_ID!.trim(),
    clientId: env.ENTRA_CLIENT_ID!.trim(),
    authority: env.ENTRA_AUTHORITY!.trim(),
    apiAudience: env.ENTRA_API_AUDIENCE!.trim(),
    redirectUri: env.ENTRA_REDIRECT_URI!.trim(),
    ...(env.ENTRA_CLIENT_CERT?.trim() ? { clientCert: env.ENTRA_CLIENT_CERT.trim() } : {}),
    ...(env.ENTRA_CLIENT_CERT_THUMBPRINT?.trim()
      ? { clientCertThumbprint: env.ENTRA_CLIENT_CERT_THUMBPRINT.trim() }
      : {}),
  };
}

/**
 * Read the session config. When Entra IS configured, `SESSION_SECRET` becomes required —
 * a BFF session store cannot sign cookies without it — so its absence is another half-set
 * (loud throw). When Entra is unset, session is irrelevant (anonymous) and this returns
 * `undefined`.
 *
 * In PRODUCTION a configured identity ALSO requires a session Valkey URL: without one the
 * store silently selects `InMemorySessionStore`, which in a multi-task ECS deploy splits
 * sessions per task so logged-in users randomly read as anonymous. That is a fail-OPEN
 * latent bug, so it is a loud throw here (E6 / R6: memory adapter for tests, Valkey for
 * prod). Non-production keeps the in-memory fallback (tests/dev run single-process).
 */
export function readSessionConfig(
  env: Record<string, string | undefined>,
  entra: EntraConfig | undefined,
): SessionConfig | undefined {
  const secret = env.SESSION_SECRET?.trim();
  if (!entra) {
    return undefined;
  }
  if (!secret) {
    throw new IdentityConfigError(
      "Entra identity is configured but SESSION_SECRET is unset; the BFF session store " +
        "cannot sign its cookies. Set SESSION_SECRET (PROD: Secrets Manager).",
    );
  }
  const valkeyUrl = env.SESSION_VALKEY_URL?.trim() || env.CACHE_VALKEY_URL?.trim() || undefined;
  if (!valkeyUrl && env.NODE_ENV === "production") {
    throw new IdentityConfigError(
      "Entra identity is configured in production but neither SESSION_VALKEY_URL nor " +
        "CACHE_VALKEY_URL is set; the session store would silently fall back to per-task " +
        "in-memory storage and split logged-in users across ECS tasks (fail-open). Set " +
        "SESSION_VALKEY_URL (or reuse CACHE_VALKEY_URL) so sessions are shared across tasks " +
        "(PROD: the ElastiCache/Valkey cluster).",
    );
  }
  return {
    secret,
    ...(valkeyUrl ? { valkeyUrl } : {}),
  };
}

/**
 * Composition-time consistency assertion (E6): force the half-set throw eagerly, so a
 * misconfigured deploy crashes at boot rather than at the first app-scoped request.
 * Fully-unset is a no-op (anonymous is a legal posture).
 */
export function assertIdentityEnvConsistent(env: Record<string, string | undefined>): void {
  const entra = readEntraConfig(env);
  readSessionConfig(env, entra);
}
