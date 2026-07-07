/**
 * D4 — the adapter `authMode` model (M12): a closed set, and value fetch composes
 * the adapter's ALLOWLISTED BASE, never the registered `url` (SSRF closed BY
 * CONSTRUCTION, not by filter). `composeValueUrl` proves the SSRF line: a
 * malicious registration `url` pointing at an attacker host must NEVER become the
 * fetch target — the composed URL is always under the allowlisted base.
 *
 * Red in Batch 0: `composeValueUrl` / `resolveStatusAdapter` throw `unimplemented`,
 * so every composition + resolution assertion fails behaviorally. Green at Batch 3.
 * Public-safe fictional hosts.
 */
import { describe, expect, it } from "vitest";
import { adapterAuthModes, composeValueUrl, resolveStatusAdapter } from "./statusAdapter";
import { DEV_TERRAFORM_BASE_URL } from "../devMocks";

const ALLOWLISTED_BASE = DEV_TERRAFORM_BASE_URL;

describe("D4: adapter authMode is a closed set", () => {
  it("is exactly caller-bearer | service-token | none", () => {
    expect([...adapterAuthModes].sort()).toEqual(["caller-bearer", "none", "service-token"]);
  });
});

describe("D4: composeValueUrl pins the fetch to the allowlisted base (SSRF closed)", () => {
  it("composes the supplied path segments under the allowlisted base", () => {
    const url = composeValueUrl(ALLOWLISTED_BASE, "api", "v2", "workspaces", "prod");
    expect(url.startsWith(ALLOWLISTED_BASE)).toBe(true);
    expect(url).toContain("workspaces/prod");
  });

  it("a malicious segment can never steer off the allowlisted base origin", () => {
    // The segments a hostile registration might smuggle in: an attacker host, a
    // link-local IP, path-traversal, an @-userinfo trick. All are hardened to
    // `[A-Za-z0-9_-]`, so the composed URL stays under the allowlisted base.
    const url = composeValueUrl(
      ALLOWLISTED_BASE,
      "..",
      "@attacker.example.net",
      "169.254.169.254",
      "steal",
    );
    expect(url.startsWith(ALLOWLISTED_BASE)).toBe(true);
    // Everything after the allowlisted base is inert alphanumerics — no host, no
    // userinfo, no traversal survived the segment hardening.
    const afterBase = url.slice(ALLOWLISTED_BASE.length);
    expect(afterBase).not.toContain("attacker.example.net");
    expect(afterBase).not.toContain("@");
    expect(afterBase).not.toContain("..");
    expect(afterBase).not.toContain("//");
  });
});

describe("D4: resolveStatusAdapter", () => {
  it("resolves the TFE service-token adapter for the tfe system", () => {
    const adapter = resolveStatusAdapter("tfe", { TERRAFORM_BASE_URL: ALLOWLISTED_BASE });
    expect(adapter?.authMode).toBe("service-token");
    expect(adapter?.allowlistedBase).toBe(ALLOWLISTED_BASE);
  });

  it("returns undefined for a system with no value-capable adapter (⇒ labeled pointer)", () => {
    expect(resolveStatusAdapter("observatory", {})).toBeUndefined();
  });
});
