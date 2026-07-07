import { jwtVerify, createRemoteJWKSet, type JWTVerifyGetKey } from "jose";

import type { IdentityClaims } from "./claims";

/**
 * Machine-surface identity validation (WS2). Verifies an Entra access token —
 * signature (against the JWKS), `iss`, `aud` (= the Context-API resource), and
 * expiry — and maps the payload to the provider-neutral {@link IdentityClaims}.
 *
 * Everything is PARAMETERIZED (locked invariant): the issuer, audience, and the JWKS
 * key source are all injected. `login.microsoftonline.com` is NEVER hardcoded — a test
 * supplies a self-signed local JWKS, a sovereign cloud supplies its own authority, prod
 * supplies the real remote JWKS. Nothing here knows it is talking to Microsoft.
 */
export type EntraTokenValidatorConfig = {
  /** Expected `iss`. */
  issuer: string;
  /** Expected `aud` — the Context-API resource (`ENTRA_API_AUDIENCE`). */
  audience: string;
  /** Key source: `createRemoteJWKSet(...)` in prod, `createLocalJWKSet(jwks)` in tests. */
  jwks: JWTVerifyGetKey;
};

/** Thrown when a machine-surface token fails validation. Callers on the machine surface
 *  translate this to an empty verified set (fail-closed), NEVER to served content. */
export class EntraTokenError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "EntraTokenError";
  }
}

/** The Entra v2 JWKS endpoint for an authority base. Parameterized — the authority is the
 *  injected base, so a mock/sovereign authority derives its own keys path. */
export function jwksUriFromAuthority(authority: string): string {
  return `${authority.replace(/\/+$/, "")}/discovery/v2.0/keys`;
}

/** A remote JWKS key source (prod). Kept thin so composition can build it from env. */
export function createRemoteEntraKeySet(jwksUri: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL(jwksUri));
}

/**
 * Validate a machine-surface Entra token and project it to {@link IdentityClaims}. Throws
 * {@link EntraTokenError} on any failure (bad signature, wrong `aud`/`iss`, expired). The
 * caller decides the fail-closed consequence — this never returns partial trust.
 */
export async function validateEntraToken(
  token: string,
  config: EntraTokenValidatorConfig,
): Promise<IdentityClaims> {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, config.jwks, {
      issuer: config.issuer,
      audience: config.audience,
    }));
  } catch (error) {
    throw new EntraTokenError("Entra token failed validation.", { cause: error });
  }

  const subject = stringClaim(payload.oid) ?? stringClaim(payload.sub) ?? undefined;
  if (!subject) {
    throw new EntraTokenError("Entra token carries no `oid`/`sub` subject claim.");
  }

  const name = stringClaim(payload.name) ?? stringClaim(payload.preferred_username);
  return {
    subject,
    ...(name ? { name } : {}),
    roles: stringArrayClaim(payload.roles),
    issuer: typeof payload.iss === "string" ? payload.iss : config.issuer,
    audience: audienceClaim(payload.aud) ?? config.audience,
    ...(stringClaim(payload.tid) ? { tenantId: stringClaim(payload.tid)! } : {}),
  };
}

function stringClaim(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function stringArrayClaim(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function audienceClaim(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === "string");
    return first;
  }
  return undefined;
}
