/**
 * Internal assembly-layer types (Step 4, I4). These are plan/execute plumbing
 * shapes — NOT an API boundary — so they stay plain TypeScript (like
 * `graphTypes`), never Zod. The wire-facing shapes (`Brief`, `BriefBlock`,
 * `OperationalLocation`, …) live in `@atlas/schema`.
 *
 * The split (I4): a PURE template turns `(graph version, scope) → BlockRequest[]`
 * — which subject nodes, which closed section subset, per-zone or once — with no
 * I/O, no fetch, no `now()`. The executor is the ONLY I/O: it resolves each
 * `BlockRequest` through the existing content path (bounded concurrency,
 * threading the `GovernedResolutionContext`, content cache only — no brief-level
 * cache, M4) into `BriefBlock[]`, then `assembleBrief` stamps the one `Brief`.
 */
import type { Brief, BriefDepth, GraphVersion, Moment, SectionId, Situation } from "@atlas/schema";

/**
 * The scope a template plans against, derived from the governed `ctx.scope`
 * (the P26 landing-zone SET + optional `appId`) plus the request's target
 * service(s). Plural from the first line — no singular zone survives (P26/P29).
 */
export type BriefScope = {
  landingZoneIds: string[];
  serviceSlugs: string[];
  appId?: string;
};

/**
 * One planned block (pure template output). Names the subject graph node, the
 * closed section subset to resolve for it (M5 relevance contract — both closed
 * sets), and the member zone on per-zone blocks (P26); LZ-independent blocks omit
 * `landingZoneId`.
 */
export type BlockRequest = {
  subject: { kind: string; id: string };
  sections: SectionId[];
  landingZoneId?: string;
};

/**
 * A pure moment template (I4/M5): graph + scope → the list of blocks to ask.
 * Structurally I/O-free — there is no `ctx`/`fetch` parameter to reach network
 * through, so honesty is table-driven and tested with NO network mocks (D2).
 */
export type BriefTemplate = (graph: GraphVersion, scope: BriefScope) => BlockRequest[];

/**
 * The assembly plan the executor turns into a `Brief`. The template produces the
 * `requests`; the route composes the `moment`/`situation`/`depth` around them and
 * hands the whole plan to {@link import("./assembleBrief").assembleBrief}.
 */
export type BriefPlan = {
  moment: Moment;
  situation: Situation;
  requests: BlockRequest[];
  depth: BriefDepth;
};

/** Re-exported for the executor's return type. */
export type { Brief };
