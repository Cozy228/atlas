import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChangeEvent } from "@atlas/schema";
import { deriveGraph } from "../graph/deriveGraph";
import { availabilityRootId, SECURITY_ROOT_ID, TERRAFORM_ROOT_ID } from "../graph/rootIds";
import type { RootSnapshot } from "../graph/graphTypes";
import { adoptTemplate, buildTemplate, changeTemplate } from "./templates";
import type { BriefScope } from "./briefTypes";

/**
 * D2 — the moment templates are PURE (I4/M5): same `(graph, scope)` ⇒ identical
 * `BlockRequest[]`, and no I/O is reachable (the signature carries no `ctx`/
 * `fetch`, so honesty is table-driven with NO network mocks). Public-safe
 * fictional data, reusing the Step-2 graph fixture vocabulary.
 *
 * Red in Batch 0: the templates throw `unimplemented`, so every determinism
 * assertion fails behaviorally. Green as Batch 2/3/4 land each template.
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
        services: [
          { slug: "cloudx/parser", name: "Parser", domain: "AI" },
          { slug: "cloudx/vault", name: "Vault", domain: "Security" },
        ],
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

const EVENTS: ChangeEvent[] = [
  {
    id: "available-in-added-parser-beta",
    class: "available-in-added",
    subject: { kind: "service", id: "cloudx/parser" },
    object: { kind: "landingZone", id: "zone-beta" },
    landingZoneIds: ["zone-beta"],
    rootId: availabilityRootId("zone-beta"),
    graphVersionFrom: "v0",
    graphVersionTo: "v1",
    derivedAt: AT,
  },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("moment templates are pure (D2)", () => {
  it("no template signature reaches I/O (no ctx/fetch parameter)", () => {
    // Structural purity: a `(graph, scope)` planner cannot touch the network.
    expect(adoptTemplate).toHaveLength(2);
    expect(buildTemplate).toHaveLength(2);
  });

  it("adopt is deterministic and never touches the network", () => {
    const graph = deriveGraph(snapshots());
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const a = adoptTemplate(graph, SCOPE);
    const b = adoptTemplate(graph, SCOPE);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("build is deterministic and never touches the network", () => {
    const graph = deriveGraph(snapshots());
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const a = buildTemplate(graph, SCOPE);
    const b = buildTemplate(graph, SCOPE);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("change is deterministic over (graph, scope, events) with the feed passed in", () => {
    const graph = deriveGraph(snapshots());
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const a = changeTemplate(graph, SCOPE, EVENTS);
    const b = changeTemplate(graph, SCOPE, EVENTS);
    expect(a).toEqual(b);
    // The pure planner reads its feed argument, never the network.
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
