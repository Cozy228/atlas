/**
 * D2 — the location index derives "where this APP's things live" from the graph's
 * edges (Step 2) PLUS the APP's registered locations, scoped to the situation
 * (M7). Each entry is a value-free `OperationalLocation` POINTER carrying
 * provenance (`discoveredFrom`); values are the status board's job (ADR-0003).
 *
 * Red in Batch 0: `deriveLocationIndex` throws `unimplemented`, so every
 * derivation assertion fails behaviorally. Green at Batch 2. Public-safe fictional
 * data, reusing the Step-2 graph vocabulary.
 */
import { describe, expect, it } from "vitest";
import type { LocationRecord } from "@atlas/schema";
import { deriveGraph } from "../graph/deriveGraph";
import { availabilityRootId, TERRAFORM_ROOT_ID } from "../graph/rootIds";
import type { RootSnapshot } from "../graph/graphTypes";
import type { BriefScope } from "../briefs/briefTypes";
import { deriveLocationIndex } from "./locationIndex";

const AT = "2026-07-06T00:00:00.000Z";

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
      rootId: TERRAFORM_ROOT_ID,
      resolvedAt: AT,
      contractVersion: "terraform-v1",
      parse: {
        kind: "terraform",
        modules: [
          {
            serviceSlug: "cloudx/parser",
            address: "app.terraform.io/example/parser/aws",
            name: "parser",
            version: "1.4.0",
          },
        ],
      },
    },
  ];
}

const REGISTERED: LocationRecord[] = [
  {
    id: "loc-orion-dashboard",
    appId: "app-orion",
    system: "observatory",
    kind: "dashboard",
    url: "https://observatory.example.com/d/orion",
    discoveredFrom: "registration",
    registeredAt: AT,
  },
];

const SCOPE: BriefScope = {
  landingZoneIds: ["zone-alpha"],
  serviceSlugs: ["cloudx/parser"],
  appId: "app-orion",
};

describe("D2: deriveLocationIndex", () => {
  it("includes the APP's registered locations as pointers (existence + provenance)", () => {
    const index = deriveLocationIndex({
      graph: deriveGraph(snapshots()),
      registrations: REGISTERED,
      scope: SCOPE,
    });
    const registered = index.find((loc) => loc.id === "loc-orion-dashboard");
    expect(registered).toBeDefined();
    expect(registered?.discoveredFrom).toBe("registration");
  });

  it("derives a location from a graph edge (a uses-module binding → a workspace pointer)", () => {
    const index = deriveLocationIndex({
      graph: deriveGraph(snapshots()),
      registrations: [],
      scope: SCOPE,
    });
    // A graph-derived pointer carries graph provenance (the terraform root), never
    // "registration".
    const derived = index.find((loc) => loc.discoveredFrom.includes(TERRAFORM_ROOT_ID));
    expect(derived).toBeDefined();
    expect(derived?.kind).toBe("workspace");
    // Value-free: an index entry is a pointer, no live value rides it (ADR-0003).
    expect(derived && "value" in derived).toBe(false);
  });

  it("scopes to the situation's services (an out-of-scope registration is excluded)", () => {
    const index = deriveLocationIndex({
      graph: deriveGraph(snapshots()),
      registrations: [...REGISTERED, { ...REGISTERED[0], id: "loc-other-app", appId: "app-other" }],
      scope: SCOPE,
    });
    expect(index.some((loc) => loc.id === "loc-other-app")).toBe(false);
  });
});
