/**
 * E2 — the BFF login/callback/logout round-trip against a MOCK IdP (zero tenant) with the
 * in-memory session store. Proves: `state` AND `nonce` are validated (PKCE covers neither),
 * session-id rotates on login, the session holds claims + refresh only, and logout is local
 * destruction.
 */
import { describe, expect, it } from "vitest";
import { InMemorySessionStore, type IdentityClaims } from "@atlas/context-layer";

import {
  AuthStateError,
  beginLogin,
  completeCallback,
  destroySession,
  pkceChallenge,
  type IdpClient,
  type LoginGenerators,
} from "./bff";

const CLAIMS: IdentityClaims = {
  subject: "fictional-user",
  name: "Fictional Operator",
  roles: ["app.orion.member"],
  issuer: "https://mock-issuer.example/v2.0",
  audience: "api://atlas-context",
};

/** A mock IdP that (like the real MSAL client) validates the id_token nonce: it was "issued"
 *  a specific nonce and rejects the exchange when the transaction nonce disagrees. */
function mockIdp(idTokenNonce: string): IdpClient {
  return {
    async authCodeUrl({ state, nonce, codeChallenge }) {
      return `https://mock-issuer.example/authorize?state=${state}&nonce=${nonce}&code_challenge=${codeChallenge}&response_mode=form_post`;
    },
    async acquireTokenByCode({ nonce }) {
      if (nonce !== idTokenNonce) {
        throw new AuthStateError("id_token nonce mismatch — replay rejected.");
      }
      return {
        claims: CLAIMS,
        refreshToken: "fictional-refresh",
        expiresAt: Date.now() + 3600_000,
      };
    },
  };
}

const pinned = (values: {
  state: string;
  nonce: string;
  verifier: string;
  sessionId?: string;
}): LoginGenerators => ({
  state: () => values.state,
  nonce: () => values.nonce,
  codeVerifier: () => values.verifier,
  ...(values.sessionId ? { sessionId: () => values.sessionId! } : {}),
});

describe("BFF auth-code round-trip (E2)", () => {
  it("beginLogin mints state+nonce+PKCE and embeds the challenge (form_post)", async () => {
    const gens = pinned({ state: "S1", nonce: "N1", verifier: "V1" });
    const { redirectUrl, transaction } = await beginLogin(mockIdp("N1"), gens);
    expect(transaction).toEqual({ state: "S1", nonce: "N1", codeVerifier: "V1" });
    expect(redirectUrl).toContain("response_mode=form_post");
    expect(redirectUrl).toContain(`code_challenge=${pkceChallenge("V1")}`);
    expect(redirectUrl).toContain("state=S1");
  });

  it("completeCallback with the matching state+nonce creates a session (claims + refresh only)", async () => {
    const store = new InMemorySessionStore();
    const gens = pinned({ state: "S1", nonce: "N1", verifier: "V1", sessionId: "sid-1" });
    const { transaction } = await beginLogin(mockIdp("N1"), gens);

    const { sessionId } = await completeCallback(
      { idp: mockIdp("N1"), sessionStore: store },
      { transaction, formState: "S1", code: "auth-code" },
      gens,
    );

    expect(sessionId).toBe("sid-1");
    const record = await store.get("sid-1");
    expect(record?.claims.subject).toBe("fictional-user");
    expect(record?.refreshToken).toBe("fictional-refresh");
    expect(record && "accessToken" in record).toBe(false);
  });

  it("rejects a WRONG state (CSRF) — PKCE does not cover this", async () => {
    const store = new InMemorySessionStore();
    const { transaction } = await beginLogin(
      mockIdp("N1"),
      pinned({ state: "S1", nonce: "N1", verifier: "V1" }),
    );
    await expect(
      completeCallback(
        { idp: mockIdp("N1"), sessionStore: store },
        { transaction, formState: "S-ATTACKER", code: "auth-code" },
      ),
    ).rejects.toBeInstanceOf(AuthStateError);
  });

  it("rejects a nonce mismatch (id_token replay) — validated separately from PKCE/state", async () => {
    const store = new InMemorySessionStore();
    const { transaction } = await beginLogin(
      mockIdp("N1"),
      pinned({ state: "S1", nonce: "N1", verifier: "V1" }),
    );
    // The IdP was issued a DIFFERENT id_token nonce ⇒ the exchange must reject even though
    // the state matches.
    await expect(
      completeCallback(
        { idp: mockIdp("N-OTHER"), sessionStore: store },
        { transaction, formState: "S1", code: "auth-code" },
      ),
    ).rejects.toBeInstanceOf(AuthStateError);
  });

  it("rotates the session id on every login", async () => {
    const store = new InMemorySessionStore();
    const first = await completeCallback(
      { idp: mockIdp("N1"), sessionStore: store },
      {
        transaction: { state: "S1", nonce: "N1", codeVerifier: "V1" },
        formState: "S1",
        code: "c1",
      },
    );
    const second = await completeCallback(
      { idp: mockIdp("N2"), sessionStore: store },
      {
        transaction: { state: "S2", nonce: "N2", codeVerifier: "V2" },
        formState: "S2",
        code: "c2",
      },
    );
    expect(first.sessionId).not.toBe(second.sessionId);
    expect(await store.get(first.sessionId)).toBeDefined();
    expect(await store.get(second.sessionId)).toBeDefined();
  });

  it("logout destroys the session locally (no IdP call)", async () => {
    const store = new InMemorySessionStore();
    const { sessionId } = await completeCallback(
      { idp: mockIdp("N1"), sessionStore: store },
      {
        transaction: { state: "S1", nonce: "N1", codeVerifier: "V1" },
        formState: "S1",
        code: "c1",
      },
    );
    await destroySession(store, sessionId);
    expect(await store.get(sessionId)).toBeUndefined();
  });
});
