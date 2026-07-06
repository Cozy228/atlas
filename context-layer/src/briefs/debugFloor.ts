/**
 * The debug brief FLOOR (Step 7, M7) — the debug moment (deferred from Step 4)
 * assembles the target capability's troubleshooting sections as CITED Evidence
 * PLUS the location index's pointers as the operational floor: content is the bar,
 * locations are the floor (P18). Free-text error interpretation is NEVER done
 * server-side (P12/P15 — the consuming agent's job); `explain_error(app, error?)`'s
 * first version routes to THIS floor (same code path discipline as the other
 * moment tools — a thin wrap over the brief handler, never a second assembly).
 *
 * A block's `evidence[]` carries the cited troubleshooting sections; a dedicated
 * floor block's `pointers[]` carries the location index (uncited existence,
 * ADR-0003) — value-free: any live value is the status board's job, never a
 * pointer's. This REPLACES Step 4's honest not-yet-available `debug` template.
 */
import type { Brief, BriefBlock, BriefDepth, LocationRecord } from "@atlas/schema";
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import { sharedLocationsRepository } from "../repositories/locationsRepositoryFactory";
import { deriveLocationIndex } from "../locations/locationIndex";
import { deriveRequestGraph } from "../graph/requestGraph";
import { assembleBrief } from "./assembleBrief";
import type { BlockRequest, BriefScope } from "./briefTypes";

export type DebugFloorInput = {
  ctx: GovernedResolutionContext;
  /** The target capability (service slug) whose troubleshooting sections + live
   *  locations the floor assembles. */
  service?: string;
  /** Citations vs excerpts (M9): the cited-Evidence half honours the caller's
   *  depth; defaults to `citations` (the agent face) like the other moments. */
  depth?: BriefDepth;
};

/** The API-face default depth (mid-level §3): citations — structure + citations,
 *  no excerpt bodies, so the agent face is consumable without excerpt cost. */
const DEFAULT_DEPTH: BriefDepth = "citations";

/**
 * The debug relevance contract (M5, closed sets, no budget): the troubleshooting
 * sections for a capability. `overview` orients; `security` covers access/config
 * misfires; `network`/`examples` (only when the graph witnesses a module edge)
 * cover connectivity + known-good usage. Pure over `(graph, scope)` — no I/O.
 */
function debugRequests(graph: Awaited<ReturnType<typeof deriveRequestGraph>>, scope: BriefScope) {
  const requests: BlockRequest[] = [];
  for (const slug of scope.serviceSlugs) {
    const subject = { kind: "service", id: slug };
    const usesModule = graph.edges.some(
      (edge) => edge.type === "uses-module" && edge.from === slug,
    );
    const sections = usesModule
      ? (["overview", "network", "security", "examples"] as const)
      : (["overview", "security"] as const);
    requests.push({ subject, sections: [...sections] });
  }
  return requests;
}

export async function assembleDebugFloor(input: DebugFloorInput): Promise<Brief> {
  const { ctx, service } = input;
  const depth = input.depth ?? DEFAULT_DEPTH;
  const situation = {
    landingZoneIds: ctx.scope?.landingZoneIds ?? [],
    origin: ctx.scope?.origin ?? ("by-value" as const),
    ...(ctx.scope?.appId ? { appId: ctx.scope.appId } : {}),
  };
  const scope: BriefScope = {
    landingZoneIds: situation.landingZoneIds,
    serviceSlugs: service ? [service] : [],
    ...(situation.appId ? { appId: situation.appId } : {}),
  };

  // ONE discovery path (D3 inversion): the same request-pinned graph the other
  // moments read. The debug floor never opens a second parse path.
  const graph = await deriveRequestGraph(ctx);

  // 1) Content is the bar — cited troubleshooting Evidence, assembled through the
  //    SAME executor as adopt/build (never a second assembly).
  const brief = await assembleBrief(
    { moment: "debug", situation, requests: debugRequests(graph, scope), depth },
    ctx,
  );

  // 2) Locations are the floor — the location index's value-free pointers
  //    (graph-derived bindings + the APP's registered locations, scoped).
  const registrations: LocationRecord[] = situation.appId
    ? await sharedLocationsRepository(readProcessEnv()).listByApp(situation.appId)
    : [];
  const pointers = deriveLocationIndex({ graph, registrations, scope });

  const floor: BriefBlock = {
    id: service ? `debug-floor:${service}` : "debug-floor",
    question: service
      ? `Where does ${service} run, and where do its operational things live?`
      : "Where do this scope's operational things live?",
    // The floor is a structural fact: it is available when a pointer exists, an
    // honest empty (never a fabricated value) when none is discovered/registered.
    status: pointers.length > 0 ? "available" : "unresolved",
    evidence: [],
    pointers,
    warnings:
      pointers.length > 0
        ? []
        : [
            {
              code: "source_unavailable",
              message: "No operational locations discovered or registered for this scope yet.",
            },
          ],
  };

  return { ...brief, blocks: [...brief.blocks, floor] };
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  };
  return processLike.process?.env ?? {};
}
