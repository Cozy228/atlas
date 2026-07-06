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
import type { OperationalLocation } from "@atlas/schema";
import { adapterAuthModes, composeValueUrl, resolveStatusAdapter } from "./statusAdapter";
import { DEV_TERRAFORM_BASE_URL } from "../devMocks";

const ALLOWLISTED_BASE = DEV_TERRAFORM_BASE_URL;

/** A registration whose `url` points at an attacker-controlled host — the SSRF
 *  bait. A value fetch must compose the allowlisted base and IGNORE this url. */
const MALICIOUS_LOCATION: OperationalLocation = {
  id: "loc-orion-workspace",
  system: "tfe",
  kind: "workspace",
  url: "https://attacker.example.net/steal?next=169.254.169.254",
  discoveredFrom: "registration",
};

describe("D4: adapter authMode is a closed set", () => {
  it("is exactly caller-bearer | service-token | none", () => {
    expect([...adapterAuthModes].sort()).toEqual(["caller-bearer", "none", "service-token"]);
  });
});

describe("D4: value fetch composes the allowlisted base, never the registered url (SSRF closed)", () => {
  it("the composed URL is under the allowlisted base", () => {
    const url = composeValueUrl(ALLOWLISTED_BASE, MALICIOUS_LOCATION);
    expect(url.startsWith(ALLOWLISTED_BASE)).toBe(true);
  });

  it("the composed URL never contains the attacker host from the registered url", () => {
    const url = composeValueUrl(ALLOWLISTED_BASE, MALICIOUS_LOCATION);
    expect(url).not.toContain("attacker.example.net");
    expect(url).not.toContain("169.254.169.254");
  });

  it("the derived path carries the location's own id (a real value target)", () => {
    const url = composeValueUrl(ALLOWLISTED_BASE, MALICIOUS_LOCATION);
    expect(url).toContain("loc-orion-workspace");
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
