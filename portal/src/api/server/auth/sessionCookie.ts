import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * BFF session cookie (WS1). The cookie carries ONLY an opaque, HMAC-signed session id — the
 * claims + refresh token live server-side in the session store (decision 7). Signing binds
 * the id to `SESSION_SECRET` so a tampered/forged cookie is rejected.
 *
 * Local-dev risk 1: the `__Host-` prefix requires HTTPS + no Domain, which browsers reject
 * on plain-HTTP `localhost`. The prefix + `Secure` are relaxed ONLY behind the dev seam
 * (`NODE_ENV !== "production"`); production always uses `__Host-` + `Secure`.
 */

const PROD_COOKIE_NAME = "__Host-atlas_session";
const DEV_COOKIE_NAME = "atlas_session";

/** True when the dev seam relaxes the `__Host-`/`Secure` cookie requirements. */
export function isDevCookieSeam(env: Record<string, string | undefined>): boolean {
  return env.NODE_ENV !== "production";
}

export function sessionCookieName(env: Record<string, string | undefined>): string {
  return isDevCookieSeam(env) ? DEV_COOKIE_NAME : PROD_COOKIE_NAME;
}

/** Sign a session id: `${id}.${base64url(hmac)}`. */
export function signSessionId(sessionId: string, secret: string): string {
  return `${sessionId}.${hmac(sessionId, secret)}`;
}

/** Verify + extract a session id from a signed value; `undefined` on tamper/format error. */
export function verifySessionId(signed: string, secret: string): string | undefined {
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) {
    return undefined;
  }
  const id = signed.slice(0, dot);
  const provided = signed.slice(dot + 1);
  const expected = hmac(id, secret);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return undefined;
  }
  return id;
}

/** Build the `Set-Cookie` header value for a signed session id. */
export function serializeSessionCookie(
  signed: string,
  env: Record<string, string | undefined>,
  maxAgeSeconds: number,
): string {
  const parts = [
    `${sessionCookieName(env)}=${signed}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ];
  if (!isDevCookieSeam(env)) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

/** Build the `Set-Cookie` header that clears the session cookie (logout). */
export function clearSessionCookie(env: Record<string, string | undefined>): string {
  const parts = [`${sessionCookieName(env)}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (!isDevCookieSeam(env)) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

/** Read the signed session value from a `Cookie` header string. */
export function readSessionCookie(
  cookieHeader: string | undefined | null,
  env: Record<string, string | undefined>,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  const name = sessionCookieName(env);
  for (const pair of cookieHeader.split(";")) {
    const eq = pair.indexOf("=");
    if (eq < 0) {
      continue;
    }
    if (pair.slice(0, eq).trim() === name) {
      return pair.slice(eq + 1).trim();
    }
  }
  return undefined;
}

function hmac(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

/* -------------------------------------------------------------------------- *
 * Login transaction cookie — carries the ephemeral PKCE verifier + state +
 * nonce between /auth/login and /auth/callback (signed, HttpOnly, short-lived).
 *
 * form_post / SameSite incompatibility (why the tx cookie is NOT Lax in prod):
 * the `/auth/callback` leg is a CROSS-SITE, top-level POST — the IdP replies to
 * `/auth/login` with `response_mode=form_post`, i.e. an auto-submitting form on
 * the IdP origin that POSTs to our callback. Browsers do NOT attach a
 * `SameSite=Lax` cookie to a cross-site POST (Lax only rides top-level GET
 * navigations), so a Lax tx cookie never arrives and every real login dies at
 * `callback.ts` "Invalid callback" (400). In the NON-dev posture the tx cookie is
 * therefore `SameSite=None; Secure` (None is required to cross the site boundary;
 * browsers reject `None` without `Secure`). The dev seam keeps `Lax`: plain-HTTP
 * `localhost` cannot set `None; Secure`, and local dev uses the Seam-B
 * resolved-outcome mock identity (no cross-site IdP round-trip). The SESSION
 * cookie stays `Lax` in both postures — it only rides same-site navigations.
 * -------------------------------------------------------------------------- */

const PROD_TX_COOKIE = "__Host-atlas_auth";
const DEV_TX_COOKIE = "atlas_auth";
const TX_MAX_AGE_SECONDS = 600;

export function txCookieName(env: Record<string, string | undefined>): string {
  return isDevCookieSeam(env) ? DEV_TX_COOKIE : PROD_TX_COOKIE;
}

/** Sign an arbitrary JSON payload: `base64url(json).hmac`. */
export function signPayload(payload: unknown, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${hmac(encoded, secret)}`;
}

/** Verify + decode a signed JSON payload; `undefined` on tamper/format error. */
export function verifyPayload<T>(signed: string, secret: string): T | undefined {
  const dot = signed.lastIndexOf(".");
  if (dot <= 0) {
    return undefined;
  }
  const encoded = signed.slice(0, dot);
  const provided = Buffer.from(signed.slice(dot + 1));
  const expected = Buffer.from(hmac(encoded, secret));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return undefined;
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString()) as T;
  } catch {
    return undefined;
  }
}

export function serializeTxCookie(signed: string, env: Record<string, string | undefined>): string {
  const dev = isDevCookieSeam(env);
  const parts = [
    `${txCookieName(env)}=${signed}`,
    "Path=/",
    "HttpOnly",
    // The cross-site `form_post` callback needs `SameSite=None; Secure` (see the module
    // comment above); the dev seam keeps `Lax` because plain-HTTP localhost cannot do
    // None+Secure and its mock identity never crosses a site boundary.
    dev ? "SameSite=Lax" : "SameSite=None",
    `Max-Age=${TX_MAX_AGE_SECONDS}`,
  ];
  if (!dev) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearTxCookie(env: Record<string, string | undefined>): string {
  const parts = [`${txCookieName(env)}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (!isDevCookieSeam(env)) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function readTxCookie(
  cookieHeader: string | undefined | null,
  env: Record<string, string | undefined>,
): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  const name = txCookieName(env);
  for (const pair of cookieHeader.split(";")) {
    const eq = pair.indexOf("=");
    if (eq < 0) {
      continue;
    }
    if (pair.slice(0, eq).trim() === name) {
      return pair.slice(eq + 1).trim();
    }
  }
  return undefined;
}
