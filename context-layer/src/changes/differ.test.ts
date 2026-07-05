import { describe, expect, it } from "vitest";
import type { GraphEdge, GraphNode, GraphVersion } from "@atlas/schema";
import { diffGraphVersions } from "./differ";

/**
 * D4 — the differ is a pure two-version golden: node/edge/version deltas map to
 * the EXACT closed `EventClass` set, and a slug rename surfaces as
 * `service-removed` + `service-added` (M6: discovery cannot see intent). The
 * differ operates on graph versions directly, so it exercises all seven classes
 * regardless of what `deriveGraph` currently emits. Public-safe fictional data.
 */

const AT = "2026-07-05T12:00:00.000Z";
const ROOT = "availability:zone-alpha";

function service(id: string, name = id): GraphNode {
  return { kind: "service", id, name };
}
function node(kind: GraphNode["kind"], id: string): GraphNode {
  return { kind, id, name: id };
}
function availableIn(from: string, to: string): GraphEdge {
  return { type: "available-in", from, to, rootId: `availability:${to}`, resolvedAt: AT };
}
function usesModule(from: string, to: string, version: string): GraphEdge {
  return { type: "uses-module", from, to, rootId: "terraform", resolvedAt: AT, version };
}
function governedBy(from: string, to: string): GraphEdge {
  return { type: "governed-by", from, to, rootId: "security", resolvedAt: AT };
}
function graph(version: string, nodes: GraphNode[], edges: GraphEdge[]): GraphVersion {
  return { version, nodes, edges, perRootFreshness: [] };
}

/** Compact signature of an event for golden set-comparison. */
function sig(e: {
  class: string;
  subject: { id: string };
  object?: { id: string };
  from?: string;
  to?: string;
}): string {
  return [e.class, e.subject.id, e.object?.id ?? "-", e.from ?? "-", e.to ?? "-"].join("|");
}

describe("diffGraphVersions (D4)", () => {
  it("service node added ⇒ service-added; removed ⇒ service-removed", () => {
    const from = graph("v0", [service("cloudx/parser")], []);
    const to = graph("v1", [service("cloudx/parser"), service("cloudx/vault")], []);

    const added = diffGraphVersions(from, to, { rootId: ROOT, derivedAt: AT });
    expect(added.map(sig)).toEqual(["service-added|cloudx/vault|-|-|-"]);

    const removed = diffGraphVersions(to, from, { rootId: ROOT, derivedAt: AT });
    expect(removed.map(sig)).toEqual(["service-removed|cloudx/vault|-|-|-"]);
  });

  it("available-in edge added/removed ⇒ available-in-added/removed carrying the LZ", () => {
    const nodes = [service("cloudx/parser"), node("landingZone", "zone-beta")];
    const from = graph("v0", nodes, []);
    const to = graph("v1", nodes, [availableIn("cloudx/parser", "zone-beta")]);

    const added = diffGraphVersions(from, to, { rootId: ROOT, derivedAt: AT });
    expect(added.map(sig)).toEqual(["available-in-added|cloudx/parser|zone-beta|-|-"]);
    expect(added[0].landingZoneIds).toContain("zone-beta");

    const removed = diffGraphVersions(to, from, { rootId: ROOT, derivedAt: AT });
    expect(removed.map(sig)).toEqual(["available-in-removed|cloudx/parser|zone-beta|-|-"]);
  });

  it("uses-module version change ⇒ module-version-changed (from→to); add/remove emit nothing", () => {
    const nodes = [service("cloudx/parser"), node("module", "acme/parser/cloudx")];
    const v120 = graph("v0", nodes, [usesModule("cloudx/parser", "acme/parser/cloudx", "1.2.0")]);
    const v130 = graph("v1", nodes, [usesModule("cloudx/parser", "acme/parser/cloudx", "1.3.0")]);

    const changed = diffGraphVersions(v120, v130, { rootId: "terraform", derivedAt: AT });
    expect(changed.map(sig)).toEqual([
      "module-version-changed|cloudx/parser|acme/parser/cloudx|1.2.0|1.3.0",
    ]);

    // A module binding appearing or disappearing is NOT an event (closed set).
    const none = graph("v2", nodes, []);
    expect(diffGraphVersions(none, v120, { rootId: "terraform", derivedAt: AT })).toEqual([]);
    expect(diffGraphVersions(v120, none, { rootId: "terraform", derivedAt: AT })).toEqual([]);
  });

  it("governed-by edge added/removed ⇒ governed-by-added/removed", () => {
    const nodes = [service("cloudx/parser"), node("guardrail", "data-residency")];
    const from = graph("v0", nodes, []);
    const to = graph("v1", nodes, [governedBy("cloudx/parser", "data-residency")]);

    expect(diffGraphVersions(from, to, { rootId: "security", derivedAt: AT }).map(sig)).toEqual([
      "governed-by-added|cloudx/parser|data-residency|-|-",
    ]);
    expect(diffGraphVersions(to, from, { rootId: "security", derivedAt: AT }).map(sig)).toEqual([
      "governed-by-removed|cloudx/parser|data-residency|-|-",
    ]);
  });

  it("a slug rename surfaces as service-removed + service-added (no rename event)", () => {
    const from = graph("v0", [service("cloudx/parser", "Parser")], []);
    const to = graph("v1", [service("cloudx/textract", "Parser")], []);

    const events = diffGraphVersions(from, to, { rootId: ROOT, derivedAt: AT });
    expect(events.map(sig).sort()).toEqual(
      ["service-added|cloudx/textract|-|-|-", "service-removed|cloudx/parser|-|-|-"].sort(),
    );
  });

  it("stamps provenance (rootId, both graph versions, derivedAt) + a stable id on every event", () => {
    const from = graph("vFrom", [service("cloudx/parser")], []);
    const to = graph("vTo", [service("cloudx/parser"), service("cloudx/vault")], []);
    const [event] = diffGraphVersions(from, to, { rootId: ROOT, derivedAt: AT });

    expect(event.rootId).toBe(ROOT);
    expect(event.graphVersionFrom).toBe("vFrom");
    expect(event.graphVersionTo).toBe("vTo");
    expect(event.derivedAt).toBe(AT);
    expect(event.id).toMatch(/^[0-9a-f]{64}$/);

    // Idempotent id: re-deriving the same transition (later wall clock) collides.
    const [again] = diffGraphVersions(from, to, {
      rootId: ROOT,
      derivedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(again.id).toBe(event.id);
  });

  it("no delta ⇒ no events", () => {
    const g = graph("v0", [service("cloudx/parser")], [availableIn("cloudx/parser", "zone-alpha")]);
    expect(diffGraphVersions(g, { ...g, version: "v1" }, { rootId: ROOT, derivedAt: AT })).toEqual(
      [],
    );
  });
});
