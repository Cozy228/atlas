import { describe, expect, it } from "vitest";
import { deriveGraph } from "../graph/deriveGraph";
import { availabilityRootId, SECURITY_ROOT_ID, TERRAFORM_ROOT_ID } from "../graph/rootIds";
import type { RootSnapshot } from "../graph/graphTypes";
import { adoptTemplate } from "./templates";
import type { BriefScope } from "./briefTypes";

/**
 * D4 — the adopt template follows the adopt edge/section contract (M5) and fans
 * out PER member zone (P26): availability + policy blocks render once per landing
 * zone in the situation's SET, LZ-independent blocks render once. Public-safe
 * fictional data, reusing the Step-2 graph vocabulary.
 *
 * Red in Batch 0: `adoptTemplate` throws `unimplemented`. Green at Batch 2.
 */

const AT = "2026-07-05T10:00:00.000Z";

function snapshots(): RootSnapshot[] {
  return [
    {
      rootId: availabilityRootId("zone-alpha"),
      resolvedAt: AT,
      contractVersion: "availability-v1",
      parse: {
        kind: "availability",
        landingZoneId: "zone-alpha",
        landingZoneName: "Alpha",
        services: [{ slug: "cloudx/parser", name: "Parser", domain: "AI" }],
      },
    },
    {
      rootId: availabilityRootId("zone-beta"),
      resolvedAt: AT,
      contractVersion: "availability-v1",
      parse: {
        kind: "availability",
        landingZoneId: "zone-beta",
        landingZoneName: "Beta",
        services: [{ slug: "cloudx/parser", name: "Parser", domain: "AI" }],
      },
    },
    {
      rootId: TERRAFORM_ROOT_ID,
      resolvedAt: AT,
      contractVersion: "terraform-v1",
      parse: {
        kind: "terraform",
        modules: [
          {
            serviceSlug: "cloudx/parser",
            address: "acme/parser/cloudx",
            name: "parser",
            version: "1.2.0",
          },
        ],
      },
    },
    {
      rootId: SECURITY_ROOT_ID,
      resolvedAt: AT,
      contractVersion: "security-v1",
      parse: {
        kind: "security",
        guardrails: [{ slug: "data-residency", name: "Data Residency" }],
        governedBy: [{ serviceSlug: "cloudx/parser", guardrailSlug: "data-residency" }],
      },
    },
  ];
}

const SCOPE: BriefScope = {
  landingZoneIds: ["zone-alpha", "zone-beta"],
  serviceSlugs: ["cloudx/parser"],
};

describe("adopt template (D4)", () => {
  it("emits per-zone blocks covering the whole LZ set (P26)", () => {
    const requests = adoptTemplate(deriveGraph(snapshots()), SCOPE);
    const zones = new Set(
      requests.filter((request) => request.landingZoneId).map((request) => request.landingZoneId),
    );
    expect(zones).toEqual(new Set(["zone-alpha", "zone-beta"]));
  });

  it("asks the availability section once per member zone (fan-out follows the LZ set)", () => {
    const requests = adoptTemplate(deriveGraph(snapshots()), SCOPE);
    const availabilityZones = requests
      .filter((request) => request.sections.includes("availability"))
      .map((request) => request.landingZoneId)
      .sort();
    expect(availabilityZones).toEqual(["zone-alpha", "zone-beta"]);
  });

  it("renders LZ-independent blocks once (no landingZoneId)", () => {
    const requests = adoptTemplate(deriveGraph(snapshots()), SCOPE);
    expect(requests.some((request) => request.landingZoneId === undefined)).toBe(true);
  });

  it("targets the adopt subject service, not an arbitrary node", () => {
    const requests = adoptTemplate(deriveGraph(snapshots()), SCOPE);
    expect(requests.length).toBeGreaterThan(0);
    expect(
      requests.every(
        (request) =>
          request.subject.id === "cloudx/parser" || request.subject.kind === "landingZone",
      ),
    ).toBe(true);
  });
});
