import type { Source, SourceClass } from "@atlas/schema";

export type ResolvedExcerpt = {
  anchor_id?: string;
  text: string;
  /**
   * Provenance clock (ADR-0013 §6): the moment this excerpt was actually parsed
   * from its Source. The live cache path stamps the original fetch time so a
   * perf-cache hit returns it unchanged; offline/recorded resolution leaves it
   * unset and callers fall back to the Source's `last_observed_at`. Kept separate
   * from the staleness clock, which is recomputed per projection and never cached.
   */
  resolved_at?: string;
  citation: {
    source_id: string;
    anchor_id?: string;
    label: string;
    location: string;
  };
};

export type ResolverWarning = {
  code:
    | "broken_anchor"
    | "source_unavailable"
    | "weak_anchoring"
    | "restricted_source"
    | "stale_source"
    | "availability_unavailable"
    // Governance-gate scope vetting (Step 1, M11): drift = value/reference
    // disagreement (value wins); unresolved = a by-reference appId with no record.
    | "scope_drift"
    | "scope_unresolved";
  message: string;
  source_id?: string;
  anchor_id?: string;
};

/**
 * The subset of the Fetch API the live providers rely on. Kept narrow so a
 * test can supply a mocked `fetch` through the resolution context.
 */
export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

/**
 * Request-scoped context threaded from the HTTP boundary down to each
 * resolver. Carries the opaque caller Bearer token (unparsed, unpersisted)
 * and the `fetch` implementation used for live source resolution.
 */
export type ResolutionContext = {
  token?: string;
  fetch: FetchLike;
  /**
   * Request-scoped fetch+parse memo, keyed by resource URL. Created per resource
   * projection and never shared across requests/identities, so N
   * anchors on the same live page/module share one fetch + one parse. Optional:
   * a caller that does not thread one keeps today's fetch-per-anchor behaviour
   * (the memo is a pure optimisation, never a correctness dependency).
   */
  pageCache?: Map<string, Promise<unknown>>;
  /**
   * The visibility/scope seam reserved by ADR-0015 §5, filled by the governance
   * gate (Step 1, M11 + P26). A no-op by default: absent ⇒ today's full,
   * global-visible return, so every un-migrated read path is unchanged
   * (progressive safety). Carries the vetted scope in the P26 set shape
   * (`landingZoneIds[]` — an APP may span zones across clouds) with its
   * provenance (`origin`). Like `app_id`, scope *filters* — it never enters the
   * `{kind}/{slug}` address. No resolver reads it yet; it rides along the context.
   */
  scope?: { landingZoneIds?: string[]; appId?: string; origin?: "by-value" | "by-reference" };
};

export type ResolveRequest = {
  source: Source;
  /** Section entry heading — a DEFAULT entry point, not a fixed address. The
   *  resolver slugifies it and locates the section at runtime by heading-slug
   *  scan; the agent may request any heading beyond the canonical vocabulary. */
  heading?: string;
  /** Structured selector for sources NOT located by heading: the availability
   *  matrix (service/region) and terraform module fields (field). */
  selector?: Record<string, string>;
  /** Citation label for the resolved excerpt (was the Anchor's citation_label). */
  citationLabel?: string;
  ctx: ResolutionContext;
};

export type ResolveResult = {
  excerpts: ResolvedExcerpt[];
  warnings: ResolverWarning[];
};

export type AnchorResolver = {
  sourceClass: SourceClass;
  resolve(request: ResolveRequest): Promise<ResolveResult>;
};
