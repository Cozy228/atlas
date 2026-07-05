/**
 * The brief executor + assembler (Step 4, I4 + ADR-0014 §2) — the ONLY I/O in
 * the assembly path. `assembleBrief` takes a pure `BriefPlan` and the governed
 * context, resolves every `BlockRequest`'s sections through the existing content
 * path (`getResourceContext` / the resolvers / `withCache`) with BOUNDED
 * CONCURRENCY (ADR-0014 §2 aggregator; the per-request `pageCache`; the threaded
 * `GovernedResolutionContext`, I2), and returns the one serialized `Brief` (I3).
 *
 * Honest-empty is mandatory (ADR-0013 §4, locked decision 3): missing data ⇒ an
 * `unresolved` block + the correct warning code (NEVER an absent block); a failed
 * fetch ⇒ a `partial` block + a warning (NEVER silent truncation). Absence of
 * data is not a negative fact.
 *
 * NO brief-level cache (M4): the content cache underneath (`withCache`, wired
 * into `ctx.fetch` by the gate) is the only cache — one clock (ADR-0013 §6). A
 * re-assembly re-runs the executor and re-reads the content cache; it never hands
 * back a memoized `Brief`.
 */
import type {
  Brief,
  BriefBlock,
  BriefDepth,
  BriefEvidence,
  OperationalLocation,
  ResourceWarning,
  SectionStatus,
} from "@atlas/schema";
import type { GovernedResolutionContext } from "../resolvers/createResolutionContext";
import { createDefaultContextService } from "../composition";
import { getResourceContext } from "../resources/resourceContextService";
import { logger, serializeError } from "../observability/logging";
import type { BlockRequest, BriefPlan } from "./briefTypes";

/** Bounded fan-out (ADR-0014 §2): the executor resolves at most this many blocks
 *  concurrently, so a wide brief never opens an unbounded number of live fetches. */
const MAX_CONCURRENCY = 6;

const log = logger("briefs");

export async function assembleBrief(
  plan: BriefPlan,
  ctx: GovernedResolutionContext,
): Promise<Brief> {
  const startedAt = Date.now();

  // The existing content path's deps (registry + resolvers + availability spine).
  // Discovery is memoized by env key inside composition, so building this per
  // assembly is cheap — and it is NOT a brief cache (M4): each assembly re-runs
  // the executor and re-reads the content cache underneath.
  const service = await createDefaultContextService();

  // One shared per-request page memo across every block (ADR-0014 §2): N sections
  // resolved from the same live page share one fetch + one parse. Created FRESH
  // per assembly (never persisted), so a re-assembly re-invokes the content-cached
  // fetch — the content cache underneath is the only cache (M4, one clock).
  const execCtx: GovernedResolutionContext = { ...ctx, pageCache: ctx.pageCache ?? new Map() };

  const blocks = await mapWithConcurrency(plan.requests, MAX_CONCURRENCY, (request) =>
    resolveBlock(service, request, plan.depth, execCtx),
  );

  const brief: Brief = {
    moment: plan.moment,
    situation: plan.situation,
    blocks,
    // The moment THIS brief was assembled (ADR-0013 §3): a resolution time, not a
    // build time. No brief cache stamps it — the executor just ran (M4).
    resolvedAt: new Date().toISOString(),
  };

  // Per-brief pino signal (mid-level §7): moment, scope, per-block status, and
  // duration — the Step 6 honesty dashboard reads these.
  log.info(
    {
      moment: brief.moment,
      landingZoneIds: brief.situation.landingZoneIds,
      ...(brief.situation.appId ? { appId: brief.situation.appId } : {}),
      blocks: blocks.map((block) => ({
        id: block.id,
        status: block.status,
        ...(block.landingZoneId ? { landingZoneId: block.landingZoneId } : {}),
      })),
      durationMs: Date.now() - startedAt,
    },
    `brief assembled: ${brief.moment} (${blocks.length} block(s))`,
  );

  return brief;
}

/**
 * Resolve one planned `BlockRequest` into a `BriefBlock` through the existing
 * content path. Every branch is honest-empty (ADR-0013 §4): a subject with no
 * content path, a genuine miss, a thrown resolution, and a per-section gap all
 * yield a warned block — never an absent block, never a fabricated body.
 */
async function resolveBlock(
  service: Awaited<ReturnType<typeof createDefaultContextService>>,
  request: BlockRequest,
  depth: BriefDepth,
  ctx: GovernedResolutionContext,
): Promise<BriefBlock> {
  const base = {
    id: blockId(request),
    question: questionFor(request),
    ...(request.landingZoneId ? { landingZoneId: request.landingZoneId } : {}),
    pointers: [] as OperationalLocation[],
  };

  // Only Resource subjects (service / guardrail) have a content projection. A
  // scope entity (e.g. a landing zone) is never Evidence (mid-level §1): the block
  // is an honest structural pointer, never a re-served body (P28).
  if (request.subject.kind !== "service" && request.subject.kind !== "guardrail") {
    return {
      ...base,
      status: "unresolved",
      evidence: [],
      warnings: [
        {
          code: "source_unavailable",
          message: `No content projection for subject '${request.subject.kind}/${request.subject.id}'.`,
        },
      ],
    };
  }

  let response;
  try {
    response = await getResourceContext(
      service,
      { kind: request.subject.kind, slug: request.subject.id, sections: request.sections },
      ctx,
    );
  } catch (error) {
    // A failed resolution is honest-empty, never a thrown brief: `partial` + a
    // warning (never silent truncation), no fabricated body.
    return {
      ...base,
      status: "partial",
      evidence: [],
      warnings: [
        {
          code: "source_unavailable",
          message: `Resolution failed for '${request.subject.id}': ${serializeError(error).message}`,
        },
      ],
    };
  }

  // A genuine miss (no identity and no record): missing data ⇒ `unresolved` + a
  // warning, never an absent block (absence of data is not a negative fact).
  if (!response) {
    return {
      ...base,
      status: "unresolved",
      evidence: [],
      warnings: [
        {
          code: "source_unavailable",
          message: `No resolvable resource for '${request.subject.kind}/${request.subject.id}'.`,
        },
      ],
    };
  }

  const evidence: BriefEvidence[] = [];
  const warnings: ResourceWarning[] = [];
  const sectionStatuses: SectionStatus[] = [];

  for (const sectionId of request.sections) {
    const section = response.sections[sectionId];
    if (!section) {
      // A requested section with no registered binding is an honest gap, reported
      // with the existing `no_registered_source` code — never a silent omission.
      const missing = response.missingSections.find((entry) => entry.section === sectionId);
      warnings.push({
        code: missing?.code ?? "no_registered_source",
        message:
          missing?.message ??
          `No ${sectionId} source registered for ${request.subject.kind}/${request.subject.id}.`,
      });
      sectionStatuses.push("unresolved");
      continue;
    }

    sectionStatuses.push(section.status);
    for (const warning of section.warnings) {
      warnings.push(warning);
    }

    // Evidence carries citations by construction (schema: citations.min(1)); a
    // section that resolved nothing contributes its status + warnings only. The
    // excerpt body is present ONLY at `depth=excerpts` (M9/P28) — `citations`
    // returns structure + citations with no bodies.
    if (section.citations.length > 0) {
      evidence.push({
        resourceId: response.resource.id,
        sectionId,
        citations: section.citations,
        excerpt: depth === "excerpts" ? section.content : null,
      });
    }
  }

  return {
    ...base,
    status: aggregateStatus(sectionStatuses),
    evidence,
    warnings: dedupeWarnings(warnings),
  };
}

/** The block's two-axis status from its resolved sections (ADR-0013 §4): all
 *  available ⇒ `available`, none resolved ⇒ `unresolved`, otherwise `partial`. */
function aggregateStatus(statuses: SectionStatus[]): SectionStatus {
  if (statuses.length === 0) {
    return "unresolved";
  }
  if (statuses.every((status) => status === "available")) {
    return "available";
  }
  if (statuses.every((status) => status === "unresolved")) {
    return "unresolved";
  }
  return "partial";
}

/** A stable, non-empty block id from the plan (subject + sections + member zone). */
function blockId(request: BlockRequest): string {
  const sections = request.sections.length > 0 ? request.sections.join("+") : "context";
  const zone = request.landingZoneId ? `@${request.landingZoneId}` : "";
  return `${request.subject.kind}:${request.subject.id}:${sections}${zone}`;
}

/** Readable, non-empty questions per relevance-contract section (M5). A block
 *  fanned out per zone (P26) states its member zone. */
const SECTION_QUESTION: Record<string, string> = {
  availability: "Where is this service available",
  network: "How does this service connect privately",
  security: "How is this service secured",
  compliance: "What compliance scope does this service carry",
  overview: "What is this service",
  pricing: "How is this service priced",
  limits: "What are this service's limits",
  examples: "How is this service used",
};

function questionFor(request: BlockRequest): string {
  const subject = request.subject.id;
  const zone = request.landingZoneId ? ` in ${request.landingZoneId}` : "";
  if (request.sections.length === 1) {
    const phrase = SECTION_QUESTION[request.sections[0]];
    if (phrase) {
      return `${phrase} (${subject})${zone}?`;
    }
  }
  const sections = request.sections.length > 0 ? request.sections.join(", ") : "context";
  return `What does ${subject} provide for ${sections}${zone}?`;
}

function dedupeWarnings(warnings: ResourceWarning[]): ResourceWarning[] {
  const seen = new Set<string>();
  const unique: ResourceWarning[] = [];
  for (const warning of warnings) {
    const key = `${warning.code}::${warning.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(warning);
    }
  }
  return unique;
}

/**
 * Bounded-concurrency map preserving input order (ADR-0014 §2 aggregator): at
 * most `limit` resolutions run at once, each worker pulling the next index until
 * the plan is drained.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await fn(items[index]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
