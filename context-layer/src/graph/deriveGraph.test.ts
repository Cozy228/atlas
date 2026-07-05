import { describe, expect, it } from "vitest";
import { deriveGraph } from "./deriveGraph";
import { availabilityRootId, SECURITY_ROOT_ID, TERRAFORM_ROOT_ID } from "./rootIds";
import type { RootSnapshot } from "./graphTypes";

/**
 * D2 — `deriveGraph` is pure + content-hashed (I1). Same snapshots ⇒ identical
 * `version`; a changed snapshot ⇒ a new version; the graph is the closed
 * vocabulary grounded in the three landed roots. Public-safe fictional data.
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

describe("deriveGraph (D2)", () => {
  it("is deterministic: identical snapshots ⇒ identical version", () => {
    const a = deriveGraph(snapshots());
    const b = deriveGraph(snapshots());
    expect(a.version).toEqual(b.version);
    expect(a.version).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is order-insensitive on input roots (content hash, not input order)", () => {
    const forward = deriveGraph(snapshots());
    const shuffled = deriveGraph([...snapshots()].reverse());
    expect(shuffled.version).toEqual(forward.version);
  });

  it("emits the closed node vocabulary grounded in the three roots", () => {
    const graph = deriveGraph(snapshots());
    const nodeKeys = graph.nodes.map((n) => `${n.kind}:${n.id}`).sort();
    expect(nodeKeys).toEqual(
      [
        "service:cloudx/parser",
        "service:cloudx/vault",
        "landingZone:zone-alpha",
        "landingZone:zone-beta",
        "module:acme/parser/cloudx",
        "guardrail:data-residency",
      ].sort(),
    );
  });

  it("emits available-in / uses-module / governed-by edges with provenance", () => {
    const graph = deriveGraph(snapshots());
    const edgeKeys = graph.edges.map((e) => `${e.type} ${e.from}->${e.to}`).sort();
    expect(edgeKeys).toEqual(
      [
        "available-in cloudx/parser->zone-alpha",
        "available-in cloudx/parser->zone-beta",
        "available-in cloudx/vault->zone-alpha",
        "uses-module cloudx/parser->acme/parser/cloudx",
        "governed-by cloudx/parser->data-residency",
      ].sort(),
    );
    const moduleEdge = graph.edges.find((e) => e.type === "uses-module");
    expect(moduleEdge?.version).toBe("1.2.0");
    expect(moduleEdge?.rootId).toBe(TERRAFORM_ROOT_ID);
    const availEdge = graph.edges.find((e) => e.to === "zone-beta");
    expect(availEdge?.rootId).toBe(availabilityRootId("zone-beta"));
  });

  it("is content-sensitive: a changed snapshot ⇒ a new version", () => {
    const base = deriveGraph(snapshots());
    const changed = snapshots();
    const terraform = changed.find((s) => s.rootId === TERRAFORM_ROOT_ID);
    if (terraform && terraform.parse.kind === "terraform") {
      terraform.parse.modules[0].version = "1.3.0";
    }
    expect(deriveGraph(changed).version).not.toEqual(base.version);
  });

  it("records per-root freshness for every input root", () => {
    const graph = deriveGraph(snapshots());
    expect(graph.perRootFreshness.map((f) => f.rootId).sort()).toEqual(
      [
        availabilityRootId("zone-alpha"),
        availabilityRootId("zone-beta"),
        TERRAFORM_ROOT_ID,
        SECURITY_ROOT_ID,
      ].sort(),
    );
  });
});
