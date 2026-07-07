/**
 * E4/E5 — the fail-closed app-scope gate. Proves, per surface, that a `visibility:"app"`
 * Source is served ONLY to a caller whose verified APP set contains its `app_id`, and is
 * otherwise fully invisible (no listing, content, count, or warning). Also proves the
 * ingestion boundary (E5: env-unconfigured + configured-but-unverified) and the revocation
 * staleness bound (F3-3).
 */
import { describe, expect, it } from "vitest";
import type { ChangeEvent, ChangesResponse, Source } from "@atlas/schema";

import { InMemorySourceRepository } from "../repositories/sourceRepository";
import type { ContextService } from "../services/contextService";
import { discoverSources } from "../services/contextService";
import { getResourceContext, listResourceCatalog } from "../resources/resourceContextService";
import { handleInstrumentsRequest } from "../api/instrumentsRoute";
import { handleChangesRequest, renderChangesAtom } from "../api/changesRoute";
import { sharedEventsRepository } from "../repositories/eventsRepositoryFactory";
import { recordBriefAssembled } from "../observability/metrics";
import type { GovernedResolutionContext } from "./createResolutionContext";
import { createResolverRegistry } from "./resolverRegistry";
import { confluencePageResolver } from "./confluencePageResolver";
import { gateSource, gateSources, isSourceVisible, verifiedAppsOf } from "./appScopeGate";

const BASE = {
  last_observed_at: "2026-06-01T00:00:00.000Z",
  last_reviewed_at: "2026-06-01T00:00:00.000Z",
  review_frequency: "P90D",
} as const;

const INTERNAL_SOURCE: Source = {
  id: "internal-doc",
  title: "Internal Doc",
  source_class: "confluence-page",
  location: "111111",
  visibility: "internal",
  ...BASE,
};

const APP_SOURCE: Source = {
  id: "orion-topology",
  title: "Orion Topology",
  source_class: "confluence-page",
  location: "999999", // 404 in fixtures → the resolver would emit source_unavailable
  visibility: "app",
  app_id: "registry-app-orion",
  ...BASE,
};

function ctxWith(verifiedApps: string[]) {
  return { verifiedApps };
}

describe("appScopeGate — the gate function (E4)", () => {
  it("non-app Sources are always visible; an app Source only to a verified member", () => {
    const empty = new Set<string>();
    const member = new Set(["registry-app-orion"]);
    expect(isSourceVisible(INTERNAL_SOURCE, empty)).toBe(true);
    expect(isSourceVisible({ ...INTERNAL_SOURCE, visibility: "restricted" }, empty)).toBe(true);
    expect(isSourceVisible(APP_SOURCE, empty)).toBe(false);
    expect(isSourceVisible(APP_SOURCE, new Set(["another-app"]))).toBe(false);
    expect(isSourceVisible(APP_SOURCE, member)).toBe(true);
  });

  it("fail-closed: an app Source with NO app_id is never visible", () => {
    const orphan = { ...APP_SOURCE, app_id: undefined } as Source;
    expect(isSourceVisible(orphan, new Set(["registry-app-orion"]))).toBe(false);
  });

  it("gateSource returns undefined for a gated Source (indistinguishable from absent)", () => {
    expect(gateSource(APP_SOURCE, ctxWith([]))).toBeUndefined();
    expect(gateSource(APP_SOURCE, ctxWith(["registry-app-orion"]))).toBe(APP_SOURCE);
    expect(gateSource(undefined, ctxWith(["registry-app-orion"]))).toBeUndefined();
  });

  it("gateSources drops every gated Source from a listing", () => {
    const all = [INTERNAL_SOURCE, APP_SOURCE];
    expect(gateSources(all, ctxWith([])).map((s) => s.id)).toEqual(["internal-doc"]);
    expect(gateSources(all, ctxWith(["registry-app-orion"])).map((s) => s.id)).toEqual([
      "internal-doc",
      "orion-topology",
    ]);
  });

  it("verifiedAppsOf reads ctx.verifiedApps, empty by default", () => {
    expect([...verifiedAppsOf({})].length).toBe(0);
    expect([...verifiedAppsOf({ verifiedApps: ["a"] })]).toEqual(["a"]);
  });
});

/** A minimal service whose registry holds one internal + one app Source. */
function serviceWith(sources: Source[]): ContextService {
  return {
    registry: {
      sources: new InMemorySourceRepository(sources),
      feedback: { list: async () => [], put: async (f: unknown) => f },
    },
    resolvers: createResolverRegistry([confluencePageResolver]),
    availabilityProvider: { listServices: async () => [], getZones: async () => [] },
    resources: [],
    now: new Date("2026-06-10T00:00:00.000Z"),
  } as unknown as ContextService;
}

describe("appScopeGate — source listing surface (/sources, E4)", () => {
  it("an unverified caller never sees the app Source in the listing", async () => {
    const service = serviceWith([INTERNAL_SOURCE, APP_SOURCE]);
    const listed = discoverSources(service, {}, ctxWith([])).sources.map((s) => s.id);
    expect(listed).toEqual(["internal-doc"]);
  });

  it("a verified member sees both", async () => {
    const service = serviceWith([INTERNAL_SOURCE, APP_SOURCE]);
    const listed = discoverSources(service, {}, ctxWith(["registry-app-orion"])).sources.map(
      (s) => s.id,
    );
    expect(listed).toEqual(["internal-doc", "orion-topology"]);
  });
});

/**
 * Deps for `getResourceContext` with one derived record binding a section to the app Source.
 * NO resolver is registered for the Source's class, so a KEPT binding surfaces a
 * deterministic `source_unavailable` warning (no network) — the observable proof the binding
 * passed the gate, while a GATED binding is dropped and leaves the section empty.
 */
function resolveDeps(sources: Source[]) {
  const record = {
    kind: "service" as const,
    slug: "aws/gated",
    name: "Gated Service",
    aliases: [],
    sections: { overview: [{ source_id: "orion-topology", order: 0, heading: "Overview" }] },
  };
  return {
    resources: [record],
    availabilityProvider: { listServices: async () => [] },
    registry: { sources: new InMemorySourceRepository(sources) },
    resolvers: createResolverRegistry([]),
    now: new Date("2026-06-10T00:00:00.000Z"),
  };
}

describe("appScopeGate — resource-content resolution surface (briefs/detail/MCP, E4)", () => {
  const params = { kind: "service" as const, slug: "aws/gated", sections: ["overview"] };

  it("an unverified caller observes the app Source in NO form (no content, id, title, warning)", async () => {
    const deps = resolveDeps([APP_SOURCE]);
    const response = await getResourceContext(deps, params, gatedCtx([]));
    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("orion-topology");
    expect(serialized).not.toContain("Orion Topology");
    // The section's only binding was gated out → dropped before counting → unresolved,
    // empty citations AND empty warnings (a gated binding never even emits a warning).
    expect(response?.sections.overview?.status).toBe("unresolved");
    expect(response?.sections.overview?.citations).toEqual([]);
    expect(response?.sections.overview?.warnings).toEqual([]);
  });

  it("a verified member's read keeps the binding (the resolver is reached → a warning appears)", async () => {
    const deps = resolveDeps([APP_SOURCE]);
    const response = await getResourceContext(deps, params, gatedCtx(["registry-app-orion"]));
    // The binding survived the gate → resolution was attempted → a non-empty warning proves
    // the app Source reached the resolver path (contrast: the gated case above emits none).
    expect(response?.sections.overview?.warnings.length).toBeGreaterThan(0);
    expect(response?.sections.overview?.warnings[0]?.code).toBe("source_unavailable");
  });
});

describe("appScopeGate — surfaces that never touch a Source (E4, by construction)", () => {
  it("the resource catalog lists records, never Source visibility/app_id", () => {
    const catalog = listResourceCatalog({
      resources: [
        {
          kind: "service",
          slug: "aws/textract",
          name: "Textract",
          aliases: [],
          sections: {},
        },
      ],
    });
    const serialized = JSON.stringify(catalog);
    expect(serialized).not.toContain("visibility");
    expect(serialized).not.toContain("app_id");
  });

  it("the instruments dashboard projects only class/counter aggregates, never Source visibility/app_id", async () => {
    // Seed the surface with app-context activity: a change event in an APP's landing zone
    // and a brief-block metric that arose while resolving an app-scoped situation. The
    // instruments read must project ONLY class/counter aggregates — never the app source's
    // id, its `app_id`, or a `visibility` field.
    await sharedEventsRepository(process.env).append([
      appContextEvent("orion-change", "service-added"),
    ]);
    recordBriefAssembled({
      moment: "adopt",
      depth: "excerpts",
      channel: "portal",
      durationMs: 3,
      blocks: [{ status: "partial", subjectKind: "service", warningCodes: ["source_unavailable"] }],
    });

    const result = await handleInstrumentsRequest(process.env);
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain("visibility");
    expect(serialized).not.toContain("app_id");
    expect(serialized).not.toContain(APP_SOURCE.id);
    expect(serialized).not.toContain(APP_SOURCE.app_id);
  });

  it("the changes / Atom feed cites roots + subjects, never Source visibility/app_id", async () => {
    // A change feed read by a VERIFIED app-scoped caller. The feed is derived from LZ deltas
    // (each entry cites its subject + source root), so it must never surface the app-scope
    // schema fields (`visibility`, `app_id`) nor the app Source's id — proving by construction
    // that scoping to an app does not leak the gated Source through the feed.
    const appScopedCtx = {
      scope: { landingZoneIds: ["awsf"], appId: "registry-app-orion", origin: "by-reference" },
      verifiedApps: ["registry-app-orion"],
    } as unknown as GovernedResolutionContext;

    const jsonResult = await handleChangesRequest(appScopedCtx);
    const jsonSerialized = JSON.stringify(jsonResult.body);
    expect(jsonSerialized).not.toContain("visibility");
    expect(jsonSerialized).not.toContain("app_id");
    expect(jsonSerialized).not.toContain(APP_SOURCE.id);

    // The Atom representation of the SAME payload — assert the same absence over the rendered
    // XML (an independent serializer, so it is checked independently).
    const response: ChangesResponse = {
      events: [appContextEvent("orion-change", "service-added")],
      cursor: null,
      roots: [],
    };
    const atom = renderChangesAtom(response, { selfUrl: "https://portal.example/api/changes" });
    expect(atom).not.toContain("visibility");
    expect(atom).not.toContain("app_id");
    expect(atom).not.toContain(APP_SOURCE.id);
    expect(atom).not.toContain(APP_SOURCE.app_id);
  });
});

/** A change event witnessed in an APP's landing zone. It references a SERVICE + a source root
 *  (as the real feed does) — never the app Source object, its `app_id`, or a `visibility`. */
function appContextEvent(id: string, cls: ChangeEvent["class"]): ChangeEvent {
  return {
    id,
    class: cls,
    subject: { kind: "service", id: "aws/checkout" },
    landingZoneIds: ["awsf"],
    rootId: "availability:awsf",
    graphVersionFrom: "v0",
    graphVersionTo: "v1",
    derivedAt: "2026-07-01T00:00:00.000Z",
  };
}

describe("appScopeGate — ingestion boundary (E5)", () => {
  it("identity unconfigured (empty verified set) ⇒ app Sources invisible everywhere", async () => {
    const service = serviceWith([INTERNAL_SOURCE, APP_SOURCE]);
    expect(discoverSources(service, {}, ctxWith([])).sources.map((s) => s.id)).toEqual([
      "internal-doc",
    ]);
  });

  it("configured but caller unverified for THIS app ⇒ still invisible", async () => {
    const service = serviceWith([INTERNAL_SOURCE, APP_SOURCE]);
    // The caller is a verified member of a DIFFERENT app.
    expect(
      discoverSources(service, {}, ctxWith(["registry-app-lyra"])).sources.map((s) => s.id),
    ).toEqual(["internal-doc"]);
  });
});

describe("appScopeGate — revocation staleness bound (F3-3)", () => {
  it("the gate reads ONLY the verified-set snapshot: a revoked member (removed from the set) loses access", () => {
    // Pre-revocation snapshot: member sees the app Source.
    expect(isSourceVisible(APP_SOURCE, new Set(["registry-app-orion"]))).toBe(true);
    // After the session/token refresh drops the membership, the snapshot no longer contains
    // the app ⇒ the Source is immediately invisible. (Bound: at most one token/session
    // lifetime of staleness; the gate never revokes mid-session — it only reads the snapshot.)
    expect(isSourceVisible(APP_SOURCE, new Set<string>())).toBe(false);
  });
});

/** Build a governed-shaped ctx carrying just the verified set for the resolve-surface test. */
function gatedCtx(verifiedApps: string[]) {
  return { verifiedApps, fetch: globalThis.fetch } as unknown as Parameters<
    typeof getResourceContext
  >[2];
}
