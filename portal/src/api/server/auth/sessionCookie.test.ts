/**
 * Cookie attribute matrix (WS1). Two cookies, two postures:
 *  - the SESSION cookie stays `SameSite=Lax` in BOTH dev and prod (it only rides same-site
 *    navigations back to the Portal);
 *  - the login-TRANSACTION cookie must be `SameSite=None; Secure` in prod so it survives the
 *    cross-site `response_mode=form_post` callback POST, and `SameSite=Lax` in dev (plain-HTTP
 *    localhost cannot do None+Secure; the dev seam uses a mock identity, no cross-site IdP).
 *  - dev relaxes the `__Host-` prefix + drops `Secure` (browsers reject `__Host-` on
 *    plain-HTTP localhost); prod keeps `__Host-` + `Secure`.
 */
import { describe, expect, it } from "vitest";

import {
  serializeSessionCookie,
  serializeTxCookie,
  sessionCookieName,
  txCookieName,
} from "./sessionCookie";

const DEV_ENV = { NODE_ENV: "development" } as Record<string, string | undefined>;
const PROD_ENV = { NODE_ENV: "production" } as Record<string, string | undefined>;

/** Split a `Set-Cookie` value into its trimmed attribute tokens. */
function attrs(setCookie: string): string[] {
  return setCookie.split(";").map((part) => part.trim());
}

describe("session cookie attribute matrix (WS1)", () => {
  it("dev: relaxed name, SameSite=Lax, NO Secure", () => {
    const value = serializeSessionCookie("sid.sig", DEV_ENV, 3600);
    const tokens = attrs(value);
    expect(sessionCookieName(DEV_ENV)).toBe("atlas_session");
    expect(tokens).toContain("HttpOnly");
    expect(tokens).toContain("SameSite=Lax");
    expect(tokens).not.toContain("Secure");
    expect(value.startsWith("atlas_session=")).toBe(true);
  });

  it("prod: __Host- name, SameSite=Lax (stays Lax), Secure", () => {
    const value = serializeSessionCookie("sid.sig", PROD_ENV, 3600);
    const tokens = attrs(value);
    expect(sessionCookieName(PROD_ENV)).toBe("__Host-atlas_session");
    expect(tokens).toContain("HttpOnly");
    // The SESSION cookie stays Lax in BOTH postures — it is never a cross-site cookie.
    expect(tokens).toContain("SameSite=Lax");
    expect(tokens).toContain("Secure");
    expect(value.startsWith("__Host-atlas_session=")).toBe(true);
  });
});

describe("login-transaction cookie attribute matrix (WS1, form_post)", () => {
  it("dev: relaxed name, SameSite=Lax, NO Secure", () => {
    const value = serializeTxCookie("payload.sig", DEV_ENV);
    const tokens = attrs(value);
    expect(txCookieName(DEV_ENV)).toBe("atlas_auth");
    expect(tokens).toContain("HttpOnly");
    expect(tokens).toContain("SameSite=Lax");
    expect(tokens).not.toContain("Secure");
  });

  it("prod: __Host- name, SameSite=None + Secure (survives the cross-site form_post POST)", () => {
    const value = serializeTxCookie("payload.sig", PROD_ENV);
    const tokens = attrs(value);
    expect(txCookieName(PROD_ENV)).toBe("__Host-atlas_auth");
    expect(tokens).toContain("HttpOnly");
    // The DISTINGUISHING attribute: None (not Lax) so a cross-site POST attaches it.
    expect(tokens).toContain("SameSite=None");
    expect(tokens).not.toContain("SameSite=Lax");
    // None is only legal WITH Secure.
    expect(tokens).toContain("Secure");
  });
});
