/**
 * R8 / R20 — the mock membership directory + mock identity are reachable ONLY through the
 * three-state dev-mock seam (`resolveDataMode()`):
 *  - mocks OFF (production posture): `membershipDirectory()` is undefined and
 *    `verifiedRegistryApps()` is empty — the mock `registryAppsAdapter` is unreachable, so it
 *    cannot leak into a real-tenant deploy (R8, adversarial-checklist item 6);
 *  - mocks ON (`DEV_MOCKS`, Seam B): a mock signed-in identity resolves with no HTTP, and its
 *    fictional roles map to the verified registry apps (Orion + Lyra) — the demoable path (R20).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger, type IdentityClaims } from "@atlas/context-layer";

import {
  logMutationAttribution,
  membershipDirectory,
  requestBrowserClaims,
  verifiedRegistryApps,
} from "./requestIdentity";

const CLAIMS: IdentityClaims = {
  subject: "fictional-user",
  roles: ["app.orion.member", "app.lyra.member"],
  issuer: "https://mock-issuer.example/v2.0",
  audience: "api://atlas-context",
};

let savedDataMode: string | undefined;
const ENTRA_VARS = [
  "ENTRA_TENANT_ID",
  "ENTRA_CLIENT_ID",
  "ENTRA_AUTHORITY",
  "ENTRA_API_AUDIENCE",
  "ENTRA_REDIRECT_URI",
];
let savedEntra: Record<string, string | undefined> = {};

beforeEach(() => {
  savedDataMode = process.env.DEV_DATA_MODE;
  savedEntra = Object.fromEntries(ENTRA_VARS.map((name) => [name, process.env[name]]));
  // Ensure Entra is unset so `loadAuthContext()` returns undefined (anonymous / Seam-B path).
  for (const name of ENTRA_VARS) delete process.env[name];
});

afterEach(() => {
  if (savedDataMode === undefined) delete process.env.DEV_DATA_MODE;
  else process.env.DEV_DATA_MODE = savedDataMode;
  for (const [name, value] of Object.entries(savedEntra)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("dev-mock seam gating (R8)", () => {
  it("mocks OFF ⇒ the mock membership directory is unreachable", async () => {
    delete process.env.DEV_DATA_MODE; // resolveDataMode() ⇒ "live"
    expect(membershipDirectory()).toBeUndefined();
    expect(await verifiedRegistryApps(CLAIMS)).toEqual([]);
  });

  it("mocks ON ⇒ the mock adapter resolves the fictional verified apps", async () => {
    process.env.DEV_DATA_MODE = "mock";
    const directory = membershipDirectory();
    expect(directory).toBeDefined();
    expect(directory?.resolveMembership).toBeDefined();
    const verified = await verifiedRegistryApps(CLAIMS);
    expect(verified.map((app) => app.id).sort()).toEqual([
      "registry-app-lyra",
      "registry-app-orion",
    ]);
    // The mock plays the registry's role: membership verified + content provenance registry.
    expect(verified.every((app) => app.membershipSource === "entra")).toBe(true);
    expect(verified.every((app) => app.origin === "registry")).toBe(true);
  });

  it("verifiedRegistryApps is empty for an anonymous caller even under mocks", async () => {
    process.env.DEV_DATA_MODE = "mock";
    expect(await verifiedRegistryApps(undefined)).toEqual([]);
  });
});

describe("consumer-state attribution logging (I2)", () => {
  const infoSpy = vi.spyOn(logger("consumer-state"), "info");

  afterEach(() => {
    infoSpy.mockClear();
  });

  it("emits ONE attribution line when a verified principal is present", () => {
    logMutationAttribution("app.update", "app-orion", CLAIMS);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [fields] = infoSpy.mock.calls[0]!;
    expect(fields).toMatchObject({
      action: "app.update",
      targetId: "app-orion",
      subject: "fictional-user",
    });
  });

  it("stays silent for an anonymous caller (no principal to attribute)", () => {
    logMutationAttribution("feedback.submit", "service/aws/textract", undefined);
    expect(infoSpy).not.toHaveBeenCalled();
  });
});

describe("Seam-B mock identity (R20)", () => {
  it("mocks ON + Entra unset ⇒ a mock signed-in identity (no HTTP, no session store)", async () => {
    process.env.DEV_DATA_MODE = "mock";
    const claims = await requestBrowserClaims();
    expect(claims?.subject).toBe("mock-entra-user");
    expect(claims?.roles).toEqual(["app.orion.member", "app.lyra.member"]);
  });

  it("mocks OFF + Entra unset ⇒ anonymous (Seam B inert)", async () => {
    delete process.env.DEV_DATA_MODE;
    expect(await requestBrowserClaims()).toBeUndefined();
  });
});
