/**
 * E2 (support) — the session store is a PORT: the in-memory adapter is fully provable so the
 * BFF round-trip runs locally with ZERO tenant. Also proves the record holds claims + refresh
 * ONLY (decision 7): there is no access-token field on {@link SessionRecord} by construction.
 */
import { describe, expect, it } from "vitest";

import type { IdentityClaims } from "../identity/claims";
import { InMemorySessionStore, type SessionRecord } from "./sessionStore";

const CLAIMS: IdentityClaims = {
  subject: "fictional-user",
  roles: ["app.orion.member"],
  issuer: "https://mock-issuer.example/v2.0",
  audience: "api://atlas-context",
};

function record(now: number): SessionRecord {
  return {
    claims: CLAIMS,
    refreshToken: "fictional-refresh",
    createdAt: now,
    expiresAt: now + 3600_000,
  };
}

describe("InMemorySessionStore (E2)", () => {
  it("set → get round-trips a session record (claims + refresh only)", async () => {
    const store = new InMemorySessionStore();
    await store.set("sid-1", record(0), 3600);
    const got = await store.get("sid-1");
    expect(got?.claims.subject).toBe("fictional-user");
    expect(got?.refreshToken).toBe("fictional-refresh");
    // Decision 7: the record type carries NO access token.
    expect(got && "accessToken" in got).toBe(false);
  });

  it("expires on read past its TTL", async () => {
    let clock = 0;
    const store = new InMemorySessionStore({ now: () => clock });
    await store.set("sid-1", record(0), 1); // 1s TTL
    clock = 500;
    expect(await store.get("sid-1")).toBeDefined();
    clock = 2000;
    expect(await store.get("sid-1")).toBeUndefined();
  });

  it("destroy removes a session (logout local destruction)", async () => {
    const store = new InMemorySessionStore();
    await store.set("sid-1", record(0), 3600);
    await store.destroy("sid-1");
    expect(await store.get("sid-1")).toBeUndefined();
  });

  it("distinct ids are independent (session-id rotation keeps sessions separate)", async () => {
    const store = new InMemorySessionStore();
    await store.set("sid-old", record(0), 3600);
    await store.set("sid-new", record(0), 3600);
    await store.destroy("sid-old");
    expect(await store.get("sid-old")).toBeUndefined();
    expect(await store.get("sid-new")).toBeDefined();
  });
});
