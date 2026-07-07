/**
 * Identity claims — the vetted, provider-neutral shape the L2 factory reads as its
 * FIRST input (I2). Produced two ways, both landing here:
 *
 *  - Browser (in-process): the BFF session's id_token claims (WS1) map to this shape.
 *  - Machine (MCP / CI / remote): an Entra access token validated by the JWKS module
 *    ({@link file://./entraTokenValidator.ts}) maps to this shape.
 *
 * The factory turns claims into a VERIFIED APP set (axis 2) via the directory port's
 * `resolveMembership`, seats ONLY the app-id set on `ResolutionContext` (identity-light —
 * `subject`/`name` never ride the context, I2), and emits the principal separately to
 * consumer-state handlers (feedback / subscriptions / apps-mutation logging).
 *
 * `roles` carries Entra **app-role values** (locked decision 7: app roles, not raw group
 * claims — sidesteps the ~200-group claims overflow). The membership adapter maps role
 * values to APP ids; nothing here interprets a role's meaning.
 */
export type IdentityClaims = {
  /** Stable principal id (Entra `oid`, falling back to `sub`). Consumer-state only. */
  subject: string;
  /** Best-effort human label (`name` / `preferred_username`). Consumer-state only. */
  name?: string;
  /** App-role values granted to this principal (decision 7). */
  roles: string[];
  /** Token issuer (`iss`) — provenance for the consumer-state audit trail. */
  issuer: string;
  /** Token audience (`aud`) — the Context-API resource on the machine surface. */
  audience: string;
  /** Entra tenant (`tid`), when present. */
  tenantId?: string;
};

/**
 * The principal attribution emitted by the factory to consumer-state handlers. It is a
 * DELIBERATELY separate value from {@link IdentityClaims} so a caller cannot accidentally
 * thread it onto the resolver path — the resolver path only ever sees the vetted app-id
 * set on `ResolutionContext.verifiedApps`.
 */
export type Principal = {
  subject: string;
  name?: string;
};

/** Narrow {@link IdentityClaims} to the consumer-state {@link Principal}. */
export function principalOf(claims: IdentityClaims): Principal {
  return claims.name === undefined
    ? { subject: claims.subject }
    : { subject: claims.subject, name: claims.name };
}
