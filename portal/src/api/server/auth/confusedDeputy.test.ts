/**
 * E3 (browser side) — the browser surface derives identity from the session COOKIE ONLY
 * (confused-deputy R7). `resolveBrowserClaims` reads the cookie; it takes no Bearer input, so
 * a Bearer sent alongside the cookie is structurally ignored. A tampered/absent cookie ⇒ no
 * identity (anonymous ⇒ app Sources fail-closed).
 */
import { describe, expect, it } from "vitest";
import {
  InMemorySessionStore,
  type IdentityClaims,
  type SessionConfig,
} from "@atlas/context-layer";

import { resolveBrowserClaims } from "./authContext";
import { serializeSessionCookie, signSessionId } from "./sessionCookie";

const SECRET = "fictional-signing-key";
const SESSION: SessionConfig = { secret: SECRET };
const CLAIMS: IdentityClaims = {
  subject: "fictional-user",
  roles: ["app.orion.member"],
  issuer: "https://mock-issuer.example/v2.0",
  audience: "api://atlas-context",
};

const devEnv = { NODE_ENV: "test" } as Record<string, string | undefined>;

async function seededStore(sessionId: string) {
  const store = new InMemorySessionStore();
  await store.set(
    sessionId,
    { claims: CLAIMS, createdAt: 0, expiresAt: Date.now() + 3600_000 },
    3600,
  );
  return store;
}

/** Build the `Cookie` header value the browser would send for a signed session id. */
function cookieHeaderFor(sessionId: string): string {
  // `serializeSessionCookie` yields "name=value; Path=/; ...": the request Cookie header is
  // just "name=value".
  return serializeSessionCookie(signSessionId(sessionId, SECRET), devEnv, 3600).split(";")[0];
}

describe("resolveBrowserClaims (E3, browser = cookie-only)", () => {
  it("derives identity from a valid session cookie", async () => {
    const store = await seededStore("sid-1");
    const claims = await resolveBrowserClaims(
      cookieHeaderFor("sid-1"),
      { session: SESSION, sessionStore: store },
      devEnv,
    );
    expect(claims?.subject).toBe("fictional-user");
  });

  it("ignores a Bearer when no cookie is present (Bearer never derives browser identity)", async () => {
    const store = await seededStore("sid-1");
    // There is no cookie — only a Bearer would be present on the request. The function has no
    // Bearer input, so identity cannot be derived: undefined.
    const claims = await resolveBrowserClaims(
      undefined,
      { session: SESSION, sessionStore: store },
      devEnv,
    );
    expect(claims).toBeUndefined();
  });

  it("rejects a tampered cookie signature", async () => {
    const store = await seededStore("sid-1");
    const tampered = `${cookieHeaderFor("sid-1")}TAMPER`;
    const claims = await resolveBrowserClaims(
      tampered,
      { session: SESSION, sessionStore: store },
      devEnv,
    );
    expect(claims).toBeUndefined();
  });

  it("returns undefined for a signed id with no live session (post-logout / expired)", async () => {
    const store = new InMemorySessionStore(); // empty
    const claims = await resolveBrowserClaims(
      cookieHeaderFor("sid-gone"),
      { session: SESSION, sessionStore: store },
      devEnv,
    );
    expect(claims).toBeUndefined();
  });

  it("BOTH a session cookie AND a Bearer present ⇒ identity derives from the COOKIE only (R7)", async () => {
    const store = await seededStore("sid-1");
    // The request carries a valid session cookie AND an opaque content Bearer. The Bearer
    // travels on the `Authorization` header, which this cookie-only function never receives
    // (it has no bearer parameter — the browser surface threads the Bearer separately as the
    // ADR-0001 content token, untouched by identity derivation). To prove the derivation reads
    // ONLY the named session cookie, we even stuff a bearer-shaped value into the cookie
    // header: the parser must pick `atlas_session` by name and ignore everything else.
    const cookieHeader = `authorization=Bearer opaque-content-token; ${cookieHeaderFor("sid-1")}`;
    const claims = await resolveBrowserClaims(
      cookieHeader,
      { session: SESSION, sessionStore: store },
      devEnv,
    );
    // Identity is the cookie's session subject — never anything bearer-derived.
    expect(claims?.subject).toBe("fictional-user");
    expect(claims?.audience).toBe("api://atlas-context");
  });
});
