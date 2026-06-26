import type { Anchor, Source, SourceClass } from "@atlas/schema";
import type { SourceContentProvider } from "./sourceContentProvider";

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
    | "availability_unavailable";
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
   * Request-scoped fetch+parse memo, keyed by resource URL. Created per bundle
   * in `buildContextBundle` and never shared across requests/identities, so N
   * anchors on the same live page/module share one fetch + one parse. Optional:
   * a caller that does not thread one keeps today's fetch-per-anchor behaviour
   * (the memo is a pure optimisation, never a correctness dependency).
   */
  pageCache?: Map<string, Promise<unknown>>;
};

/**
 * Default context for callers that do not supply one (existing in-process
 * callers and tests). No token means the live providers defer to the offline
 * pilot map; `globalThis.fetch` is only used when a live provider is reached.
 */
export function offlineResolutionContext(): ResolutionContext {
  const runtime = globalThis as typeof globalThis & { fetch?: FetchLike };
  return { token: undefined, fetch: runtime.fetch as FetchLike };
}

export type ResolveRequest = {
  source: Source;
  anchors: Anchor[];
  anchorId?: string;
  contentProvider: SourceContentProvider;
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
