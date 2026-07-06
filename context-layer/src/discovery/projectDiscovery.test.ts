import { describe, expect, it } from "vitest";
import { reconstructDiscovery } from "./projectDiscovery";
import { normalizeServiceIdentity } from "../services/serviceIdentityNormalizer";
import type { RootSnapshot } from "../graph/graphTypes";

/**
 * T2a (D3 projection inversion) — the composition projection reconstructs the
 * `DiscoveredService[]` / `DiscoveredGuardrail[]` byte-stably from the per-root
 * snapshots: a service identity re-derives from its `{provider}/{id}` slug,
 * modules regain their synthetic `sourceId` + empty list-only `headings`, and a
 * guardrail carries the `pageId` the security parse now snapshots. Public-safe
 * fictional data.
 */

function availability(
  landingZoneId: string,
  services: { id: string; name: string }[],
): RootSnapshot {
  return {
    rootId: `availability:${landingZoneId}`,
    resolvedAt: "2026-07-06T00:00:00.000Z",
    contractVersion: "availability-v1",
    parse: {
      kind: "availability",
      landingZoneId,
      landingZoneName: landingZoneId,
      services: services.map((svc) => ({
        slug: `cloudx/${svc.id}`,
        name: svc.name,
        domain: "AI",
      })),
    },
  };
}

const terraform: RootSnapshot = {
  rootId: "terraform",
  resolvedAt: "2026-07-06T00:00:00.000Z",
  contractVersion: "terraform-v1",
  parse: {
    kind: "terraform",
    modules: [{ serviceSlug: "cloudx/vision", address: "org/vision/cloudx", name: "vision" }],
  },
};

const security: RootSnapshot = {
  rootId: "security",
  resolvedAt: "2026-07-06T00:00:00.000Z",
  contractVersion: "security-v2",
  parse: {
    kind: "security",
    guardrails: [{ slug: "data-residency", name: "Data Residency", pageId: "page-42" }],
  },
};

describe("reconstructDiscovery (T2a / D3)", () => {
  it("re-derives service identities from the snapshot slug + name", () => {
    const { services } = reconstructDiscovery([
      availability("zone-alpha", [{ id: "vision", name: "Vision" }]),
    ]);
    expect(services).toHaveLength(1);
    // Byte-identical to what discovery formed from the same spine tuple.
    expect(services[0].identity).toEqual(
      normalizeServiceIdentity({ provider: "cloudx", id: "vision", name: "Vision" }),
    );
    expect(services[0].domain).toBe("AI");
    expect(services[0].modules).toEqual([]);
  });

  it("attaches terraform modules by service key with list-only shape", () => {
    const { services } = reconstructDiscovery([
      availability("zone-alpha", [{ id: "vision", name: "Vision" }]),
      terraform,
    ]);
    expect(services[0].modules).toEqual([
      {
        sourceId: "vision-module-readme",
        name: "vision",
        address: "org/vision/cloudx",
        headings: [],
      },
    ]);
  });

  it("dedupes a service seen across landing zones, first-seen order preserved", () => {
    const { services } = reconstructDiscovery([
      availability("zone-alpha", [
        { id: "vision", name: "Vision" },
        { id: "speech", name: "Speech" },
      ]),
      availability("zone-beta", [{ id: "vision", name: "Vision" }]),
    ]);
    expect(services.map((s) => s.identity.id)).toEqual(["vision", "speech"]);
  });

  it("reconstructs guardrails with the snapshot pageId", () => {
    const { guardrails } = reconstructDiscovery([security]);
    expect(guardrails).toEqual([
      { slug: "data-residency", name: "Data Residency", pageId: "page-42", headings: [] },
    ]);
  });
});
