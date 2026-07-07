/**
 * E3 (machine side, through the real router) — the machine surface derives identity from the
 * Authorization Bearer ONLY (confused-deputy R7). Driving `handleHttpRequest` with BOTH a
 * Cookie header and a Bearer must derive identity from the BEARER path only; the Cookie is
 * NEVER consulted. We spy on the identity seam (`resolveMachineClaims`) and assert it is
 * invoked with the bearer extracted from `Authorization` and no cookie value — the cookie
 * header cannot influence machine identity because it is never read.
 */
import { describe, expect, it, vi, type Mock } from "vitest";

vi.mock("../identity/machineIdentity", () => ({
  resolveMachineClaims: vi.fn(async () => undefined),
}));

import { handleHttpRequest } from "./httpRoute";
import { resolveMachineClaims } from "../identity/machineIdentity";

const spy = resolveMachineClaims as unknown as Mock;

describe("machine surface confused-deputy (E3, through handleHttpRequest)", () => {
  it("BOTH a Cookie and a Bearer ⇒ identity derives from the Bearer only; the cookie is never consulted", async () => {
    spy.mockClear();
    // A 404 path still builds the resolution context (identity is derived BEFORE routing), so
    // this stays cheap while exercising the real machine identity seam.
    await handleHttpRequest({
      method: "GET",
      path: "/__nonexistent__",
      headers: {
        authorization: "Bearer machine-token",
        cookie: "__Host-atlas_session=sid.deadbeef; other=1",
      },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const call = spy.mock.calls[0];
    // Identity is derived from the Authorization Bearer value...
    expect(call[0]).toBe("machine-token");
    // ...and from exactly (bearer, env) — there is no cookie argument, so the cookie cannot
    // feed machine identity. Assert no argument carries the cookie's session value.
    expect(JSON.stringify(call)).not.toContain("sid.deadbeef");
    expect(JSON.stringify(call)).not.toContain("__Host-atlas_session");
  });

  it("a Cookie WITHOUT a Bearer ⇒ the bearer argument is undefined (cookie yields no identity)", async () => {
    spy.mockClear();
    await handleHttpRequest({
      method: "GET",
      path: "/__nonexistent__",
      headers: { cookie: "__Host-atlas_session=sid.deadbeef" },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    // No Authorization header ⇒ no bearer ⇒ no machine identity. The cookie is inert here.
    expect(spy.mock.calls[0][0]).toBeUndefined();
  });
});
