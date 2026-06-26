import {
  sectionIds,
  type ContextSection,
  type MissingSection,
  type ResourceCitation,
  type ResourceContextResponse,
  type ResourceKind,
  type ResourceProjectionRecord,
  type ResourceSearchResponse,
  type ResourceSectionBinding,
  type ResourceSummary,
  type ResourceWarning,
  type SectionStatus,
} from "@atlas/schema";
import type { ResolverRegistry } from "../resolvers/resolverRegistry";
import { offlineResolutionContext, type ResolutionContext } from "../resolvers/resolverTypes";
import type { SourceContentProvider } from "../resolvers/sourceContentProvider";
import { isStale } from "../services/freshness";
import { getResourceKindDef } from "./resourceKindRegistry";

/**
 * Live resource projection (ADR-0013). The agent-facing resource surface is a
 * projection of external Sources, not a stored document: each request loads a
 * resource's Section Projection Plan, live-resolves the referenced Sources via
 * the SAME resolver registry the Context bundle uses, and aggregates successes
 * by Section. Failures never fall back to a previously resolved excerpt.
 *
 * Two orthogonal axes (proposal §5.6): a Section carries a resolution `status`
 * (available / partial / unresolved) and a list of `warnings` whose codes are
 * drawn from `@atlas/schema` `warningCodes` — never a parallel status word.
 */

/**
 * The slice of a ContextBundleService the projection facade needs. Declared
 * structurally so this module does not import the service (and cannot form an
 * import cycle); `ContextBundleService` satisfies it.
 */
export type ResourceProjectionDeps = {
  resources: ResourceProjectionRecord[];
  registry: {
    sources: { getById(id: string): import("@atlas/schema").Source | undefined };
    anchors: { findBySourceId(sourceId: string): import("@atlas/schema").Anchor[] };
  };
  resolvers: ResolverRegistry;
  contentProvider: SourceContentProvider;
  now: Date;
};

const KNOWN_SECTION_IDS = new Set<string>(sectionIds);

/** Thrown for a request the caller got wrong (HTTP maps this to 400 invalid_request). */
export class InvalidResourceRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidResourceRequestError";
  }
}

export type SearchResourcesOptions = { baseUrl?: string };

/**
 * Resolve a free-text name to canonical resource ids. Search answers no
 * questions (proposal §5.7) — it only maps names/aliases to `{kind}/{slug}` and
 * the URLs to read them.
 */
export function searchResources(
  deps: ResourceProjectionDeps,
  query: string,
  options: SearchResourcesOptions = {},
): ResourceSearchResponse {
  const tokens = normalizeTokens(query);
  const trimmed = query.trim().toLowerCase();

  const scored = deps.resources
    .map((record) => ({ record, match: scoreMatch(record, trimmed, tokens) }))
    .filter(
      (entry): entry is { record: ResourceProjectionRecord; match: MatchScore } =>
        entry.match !== null,
    )
    .sort((a, b) => b.match.score - a.match.score);

  return {
    items: scored.map(({ record, match }) => ({
      ...toResourceSummary(record, options.baseUrl),
      matchReason: match.reason,
    })),
  };
}

export type GetResourceContextParams = {
  kind: ResourceKind;
  slug: string;
  /** Optional Section filter; omitted = all Sections registered for the kind. */
  sections?: string[];
  baseUrl?: string;
};

/**
 * Project a resource's Sections by live-resolving its Projection Plan. Returns
 * `null` when no such resource is registered (HTTP maps this to 404 →
 * `searchResources`). A requested Section with no registered binding is reported
 * in `missingSections` (no_registered_source); a Section whose Sources all fail
 * to resolve is returned with `status: unresolved` + warnings — never stale data.
 */
export async function getResourceContext(
  deps: ResourceProjectionDeps,
  params: GetResourceContextParams,
  ctx: ResolutionContext = offlineResolutionContext(),
): Promise<ResourceContextResponse | null> {
  const record = findRecord(deps.resources, params.kind, params.slug);
  if (!record) {
    return null;
  }

  const requested = resolveRequestedSections(record, params.sections);

  const sectionsOut: Record<string, ContextSection> = {};
  const missingSections: MissingSection[] = [];

  for (const sectionId of requested) {
    const bindings = record.sections[sectionId];
    if (!bindings || bindings.length === 0) {
      missingSections.push({
        section: sectionId,
        code: "no_registered_source",
        message: `Atlas has no registered ${sectionId} source for ${record.kind}/${record.slug}. This is missing data, not evidence of a negative answer.`,
      });
      continue;
    }
    sectionsOut[sectionId] = await resolveSection(deps, bindings, ctx);
  }

  return {
    resource: toResourceSummary(record, params.baseUrl),
    requestedSections: requested,
    sections: sectionsOut,
    missingSections,
    // Top-level: the moment THIS projection ran (ADR-0013 §3). Distinct from each
    // citation's resolvedAt, which is the excerpt's own parse time.
    resolvedAt: deps.now.toISOString(),
  };
}

/** Resolve one Section by live-resolving each of its ordered bindings. */
async function resolveSection(
  deps: ResourceProjectionDeps,
  bindings: ResourceSectionBinding[],
  ctx: ResolutionContext,
): Promise<ContextSection> {
  const ordered = [...bindings].sort((a, b) => a.order - b.order);
  const contentParts: string[] = [];
  const citations: ResourceCitation[] = [];
  const warnings: ResourceWarning[] = [];
  let resolvedBindings = 0;

  for (const binding of ordered) {
    const source = deps.registry.sources.getById(binding.source_id);
    if (!source) {
      warnings.push({
        code: "no_registered_source",
        message: `Binding references unknown source '${binding.source_id}'.`,
      });
      continue;
    }

    // Governance warnings are recomputed per projection (never cached): visibility
    // and the staleness clock (ADR-0013 §6).
    if (source.visibility === "restricted") {
      warnings.push({
        code: "restricted_source",
        message: `Source '${source.id}' has restricted visibility.`,
      });
    }
    if (isStale(source, deps.now)) {
      warnings.push({
        code: "stale_source",
        message: `Source '${source.id}' is past its review frequency.`,
      });
    }

    const resolver = deps.resolvers.get(source.source_class);
    if (!resolver) {
      warnings.push({
        code: "source_unavailable",
        message: `No resolver registered for source class '${source.source_class}'.`,
      });
      continue;
    }

    const result = await resolver.resolve({
      source,
      anchors: deps.registry.anchors.findBySourceId(source.id),
      anchorId: binding.anchor_id,
      contentProvider: deps.contentProvider,
      ctx,
    });

    for (const warning of result.warnings) {
      warnings.push({ code: warning.code, message: warning.message });
    }

    if (result.excerpts.length > 0) {
      resolvedBindings += 1;
      for (const excerpt of result.excerpts) {
        contentParts.push(excerpt.text);
        citations.push({
          sourceId: source.id,
          title: source.title,
          url: excerpt.citation.location,
          ...((excerpt.anchor_id ?? binding.anchor_id)
            ? { anchor: excerpt.anchor_id ?? binding.anchor_id }
            : {}),
          // Provenance clock: the moment this content was parsed from Source. For
          // the offline/recorded path that is the Source's last observation; the
          // live cache path stamps the real fetch time (kept separate from the
          // staleness clock above — ADR-0013 §6).
          resolvedAt: excerptResolvedAt(excerpt, source.last_observed_at),
        });
      }
    }
  }

  const status: SectionStatus =
    resolvedBindings === 0
      ? "unresolved"
      : resolvedBindings < ordered.length
        ? "partial"
        : "available";

  return {
    status,
    content: contentParts.length > 0 ? contentParts.join("\n\n") : null,
    citations,
    warnings: dedupeWarnings(warnings),
  };
}

/**
 * The excerpt's parse time. The offline resolvers do not (yet) stamp one, so we
 * fall back to the Source's recorded observation time — honest provenance that
 * never claims a static excerpt was "just resolved". The live cache path stamps
 * `resolved_at` on the excerpt directly.
 */
function excerptResolvedAt(excerpt: { resolved_at?: string }, lastObservedAt: string): string {
  return excerpt.resolved_at ?? lastObservedAt;
}

function resolveRequestedSections(
  record: ResourceProjectionRecord,
  requested: string[] | undefined,
): string[] {
  const kindDef = getResourceKindDef(record.kind);
  const vocab = kindDef
    ? kindDef.sections.map((section) => section.id)
    : Object.keys(record.sections);

  if (!requested || requested.length === 0) {
    return vocab;
  }

  for (const section of requested) {
    if (!KNOWN_SECTION_IDS.has(section)) {
      throw new InvalidResourceRequestError(
        `Unknown section '${section}'. Valid sections come from the OpenAPI 'sections' enum.`,
      );
    }
  }
  // De-duplicate while preserving caller order.
  return Array.from(new Set(requested));
}

function findRecord(
  records: ResourceProjectionRecord[],
  kind: string,
  slug: string,
): ResourceProjectionRecord | undefined {
  return records.find((record) => record.kind === kind && record.slug === slug);
}

function toResourceSummary(record: ResourceProjectionRecord, baseUrl?: string): ResourceSummary {
  const id = `${record.kind}/${record.slug}`;
  const base = baseUrl ?? "";
  return {
    kind: record.kind,
    id,
    slug: record.slug,
    ...(record.provider ? { provider: record.provider } : {}),
    name: record.name,
    aliases: record.aliases,
    resourceUrl: `${base}/api/resources/${id}`,
    markdownUrl: `${base}/resources/${id}.md`,
  };
}

type MatchScore = { score: number; reason: string };

function scoreMatch(
  record: ResourceProjectionRecord,
  trimmedQuery: string,
  tokens: string[],
): MatchScore | null {
  const names = [record.name, ...record.aliases].map((value) => value.toLowerCase());
  if (trimmedQuery.length > 0 && names.includes(trimmedQuery)) {
    return { score: 100, reason: "Exact name or alias match" };
  }

  const haystack = [record.name, ...record.aliases, record.slug, record.provider ?? "", record.kind]
    .join(" ")
    .toLowerCase();

  if (tokens.length === 0) {
    return null;
  }
  const matched = tokens.filter((token) => haystack.includes(token));
  if (matched.length === tokens.length) {
    return { score: 50, reason: "Matched on name and aliases" };
  }
  if (matched.length > 0) {
    return { score: 10, reason: "Partial name match" };
  }
  return null;
}

function normalizeTokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((token) => token.length >= 2);
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
