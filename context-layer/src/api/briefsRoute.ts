/**
 * The brief route family (Step 4, mid-level §3, I3) — governed + scoped, on the
 * one governed router. `GET /api/briefs/{moment}?service=…&app=…` (fallback
 * `&lz=`) resolves the situation from `ctx.scope` and assembles the one `Brief`
 * value (template → executor); `?since=` narrows the change moment; `?depth=`
 * selects citations vs excerpts (M9). `/briefs/{moment}.md` renders the SAME
 * `Brief` value as Markdown (a stable address, ≠ a stored file; stamped
 * `resolvedAt`), the same seam as `/resources/{…}.md`.
 *
 * `debug` is a documented not-yet-available honest response (Step 7, M7): never a
 * fabricated block (D11). The API face defaults to `depth=citations` (structure +
 * citations, MCP-shaped) per mid-level §3; the Portal human render asks
 * `excerpts` explicitly.
 */
import {
  moments,
  type ApiErrorResponse,
  type Brief,
  type BriefBlock,
  type BriefDepth,
  type BriefEvidence,
  type ChangeEvent,
  type ChangesResponse,
  type Moment,
  type Situation,
} from "@atlas/schema";
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import { assembleBrief } from "../briefs/assembleBrief";
import { assembleDebugFloor } from "../briefs/debugFloor";
import { changeTemplate, templateForMoment } from "../briefs/templates";
import type { BriefScope } from "../briefs/briefTypes";
import { deriveRequestGraph } from "../graph/requestGraph";
import { deriveGraph } from "../graph/deriveGraph";
import { handleChangesRequest } from "./changesRoute";
import { errorResponse, type ApiResponse } from "./routeTypes";

export type BriefRequestOptions = {
  /** The target service slug for adopt/build (`?service=`). */
  service?: string;
  /** Incremental cursor for the change moment (`?since=`). */
  since?: string;
  /** Citations vs excerpts (M9/P28); defaults to `citations` for MCP-shaped
   *  callers per mid-level §3, `excerpts` for human renders. */
  depth?: BriefDepth;
};

/** The API face default (mid-level §3): citations — structure + citations with no
 *  excerpt bodies, so the agent face is consumable without paying excerpt cost. */
const API_DEFAULT_DEPTH: BriefDepth = "citations";

export async function handleBriefRequest(
  moment: string,
  ctx: GovernedResolutionContext,
  options: BriefRequestOptions = {},
): Promise<ApiResponse<ApiErrorResponse | Brief>> {
  if (!isMoment(moment)) {
    return errorResponse(
      400,
      "invalid_request",
      `Unknown moment '${moment}'. Valid moments: ${moments.join(", ")}.`,
    );
  }

  const situation = situationFromContext(ctx);
  const depth = options.depth ?? API_DEFAULT_DEPTH;

  // `debug` is Step 7's M7 floor: cited troubleshooting Evidence PLUS the location
  // index's pointers (content is the bar, locations are the floor — P18). The SAME
  // assembly path `explain_error` will thin-wrap; free-text error interpretation
  // stays client-side (P12/P15). Replaces Step 4's not-yet-available template.
  if (moment === "debug") {
    return {
      status: 200,
      body: await assembleDebugFloor({ ctx, service: options.service, depth }),
    };
  }

  // `change` reads the Step-2 derived feed (M8/P31), NOT a graph traversal.
  if (moment === "change") {
    return { status: 200, body: await assembleChangeBrief(situation, ctx, options.since, depth) };
  }

  // adopt | build: the plan/execute split (I4). A pure template plans the blocks
  // from the pinned graph version + scope; the executor is the only I/O.
  const scope: BriefScope = {
    landingZoneIds: situation.landingZoneIds,
    serviceSlugs: options.service ? [options.service] : [],
    ...(situation.appId ? { appId: situation.appId } : {}),
  };
  const graph = await deriveRequestGraph(ctx);
  const requests = templateForMoment(moment)(graph, scope);
  const brief = await assembleBrief({ moment, situation, requests, depth }, ctx);
  return { status: 200, body: brief };
}

/** Render one `Brief` value as Markdown for `/briefs/{moment}.md` (I3: the same
 *  value the JSON + Portal faces consume; face drift is unwritable). */
export function renderBriefMarkdown(brief: Brief): string {
  const lines: string[] = [];
  lines.push(`# ${titleCase(brief.moment)} brief`);
  lines.push("");
  const scope =
    brief.situation.landingZoneIds.length > 0
      ? brief.situation.landingZoneIds.join(", ")
      : "(unscoped)";
  lines.push(`**Landing zones:** ${scope}`);
  if (brief.situation.appId) {
    lines.push(`**App:** ${brief.situation.appId}`);
  }
  lines.push(`**Resolved at:** ${brief.resolvedAt}`);
  lines.push("");

  if (brief.blocks.length === 0) {
    lines.push("_No blocks — this moment is not yet available._");
    lines.push("");
    return lines.join("\n");
  }

  for (const block of brief.blocks) {
    const zone = block.landingZoneId ? ` — ${block.landingZoneId}` : "";
    lines.push(`## ${block.question}${zone}`);
    lines.push("");
    lines.push(`_Status: ${block.status}_`);
    lines.push("");
    for (const evidence of block.evidence) {
      if (evidence.excerpt) {
        lines.push(evidence.excerpt);
        lines.push("");
      }
      for (const citation of evidence.citations) {
        lines.push(`- [${citation.title}](${citation.url})`);
      }
      lines.push("");
    }
    for (const warning of block.warnings) {
      lines.push(`> ⚠️ ${warning.code}: ${warning.message}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * The change brief (D6): the executor reads the scoped Step-2 feed
 * (`handleChangesRequest` — the only I/O, filtered to `ctx.scope`, incremental
 * from `since`), the PURE `changeTemplate` plans one block per event, and each
 * block announces its cited event. The change moment's substrate is the derived
 * feed, so it pins an empty node graph (I1 shape) — the events carry from/to +
 * provenance themselves.
 */
async function assembleChangeBrief(
  situation: Situation,
  ctx: GovernedResolutionContext,
  since: string | undefined,
  depth: BriefDepth,
): Promise<Brief> {
  const feed = await handleChangesRequest(ctx, { since });
  const events = (feed.body as ChangesResponse).events;
  const scope: BriefScope = {
    landingZoneIds: situation.landingZoneIds,
    serviceSlugs: [],
    ...(situation.appId ? { appId: situation.appId } : {}),
  };
  const requests = changeTemplate(deriveGraph([]), scope, events);
  const blocks = events.map((event, index) =>
    changeBlock(event, requests[index]?.landingZoneId, depth),
  );
  return {
    moment: "change",
    situation,
    blocks,
    resolvedAt: new Date().toISOString(),
  };
}

const CLASS_PHRASE: Record<string, string> = {
  "service-added": "became available",
  "service-removed": "was withdrawn",
  "available-in-added": "became available in",
  "available-in-removed": "was withdrawn from",
  "module-version-changed": "changed module version",
  "governed-by-added": "is now governed by",
  "governed-by-removed": "is no longer governed by",
};

/** One announced change (P28: the event is the join — the block states the delta,
 *  it never re-serves the changed resource's body; the agent follows the feed /
 *  resource atom for detail). Each block CITES its event's provenance (D6/M8): the
 *  subject node as the resource + the source root as the citation `sourceId`.
 *  Fully resolved as a structural fact ⇒ `available`. */
function changeBlock(
  event: ChangeEvent,
  landingZoneId: string | undefined,
  depth: BriefDepth,
): BriefBlock {
  const phrase = CLASS_PHRASE[event.class] ?? event.class;
  const target = event.object ? `${event.subject.id} → ${event.object.id}` : event.subject.id;
  const delta = event.from && event.to ? ` (${event.from} → ${event.to})` : "";
  // The event IS the evidence: the subject node ({kind}/{slug}) is the resource,
  // the source root witnessed it. M9: the one-line delta summary is an excerpt
  // body, so it rides `excerpts` depth only and is null at `citations`.
  const evidence: BriefEvidence = {
    resourceId: `service/${event.subject.id}`,
    sectionId: "change-event",
    citations: [
      {
        sourceId: event.rootId,
        title: `Change event ${event.id}`,
        url: `urn:atlas:change:${event.id}`,
        resolvedAt: event.derivedAt,
      },
    ],
    excerpt: depth === "excerpts" ? changeSummary(event, phrase) : null,
  };
  return {
    id: event.id,
    question: `What changed: ${event.subject.id} ${phrase} ${target}${delta}?`,
    ...(landingZoneId ? { landingZoneId } : {}),
    status: "available",
    evidence: [evidence],
    pointers: [],
    warnings: [],
  };
}

/** A one-line declarative summary of the event's delta (the `excerpts`-depth
 *  excerpt body — the interrogative lives in the block `question`). */
function changeSummary(event: ChangeEvent, phrase: string): string {
  const to = event.object ? ` ${event.object.id}` : "";
  const delta = event.from && event.to ? ` (${event.from} → ${event.to})` : "";
  return `${event.subject.id} ${phrase}${to}${delta}.`;
}

/** Build the situation from the governed scope (I2/P30): the vetted LZ set + its
 *  provenance (`by-value` / `by-reference`) — never a consumer-state read. An
 *  unscoped ctx yields an empty LZ set with the default by-value provenance. */
function situationFromContext(ctx: GovernedResolutionContext): Situation {
  return {
    landingZoneIds: ctx.scope?.landingZoneIds ?? [],
    origin: ctx.scope?.origin ?? "by-value",
    ...(ctx.scope?.appId ? { appId: ctx.scope.appId } : {}),
  };
}

function isMoment(value: string): value is Moment {
  return (moments as readonly string[]).includes(value);
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
