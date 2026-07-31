import {
  SearchContextInputSchema,
  SearchContextResponseSchema,
  SectionIdSchema,
  type SearchContextInput,
  type SearchContextResponse,
} from "@atlas/schema";

import type { ContextService } from "../services/contextService";
import {
  getResourceContext,
  normalizeSearchTokens,
  resourceSearchMetadataText,
  searchResources,
} from "../resources/resourceContextService";
import type { ResolutionContext } from "../resolvers/resolverTypes";

const EXCERPT_CHAR_LIMIT = 1_500;
const EXCERPT_LEAD_CHARS = 240;
const EXCERPTS_PER_MATCH_LIMIT = 3;

/**
 * Search registered Resource, Source, and Anchor metadata first, then
 * live-resolve only the bounded candidate set and return the Sections that
 * match the caller's keywords. Source content is never mirrored or scanned
 * globally.
 */
export async function searchContext(
  service: ContextService,
  rawInput: SearchContextInput,
  ctx?: ResolutionContext,
): Promise<SearchContextResponse> {
  const input = SearchContextInputSchema.parse(rawInput);
  const tokens = normalizeSearchTokens(input.query);
  const candidates = searchResources(service, input.query)
    .items.filter((resource) => !input.kind || resource.kind === input.kind)
    .slice(0, input.limit);

  const matches: SearchContextResponse["matches"] = [];
  for (const candidate of candidates) {
    const projection = await getResourceContext(
      service,
      {
        kind: candidate.kind,
        slug: candidate.slug,
        sections: input.sections,
      },
      ctx,
    );
    if (!projection) continue;

    const available = Object.entries(projection.sections).flatMap(([sectionId, section]) =>
      section.content && section.citations.length > 0
        ? [{ sectionId, section, content: section.content }]
        : [],
    );
    const relevant = available.filter(({ content }) =>
      tokens.some((token) => content.toLowerCase().includes(token)),
    );
    const selected = (relevant.length > 0 ? relevant : available.slice(0, 1)).slice(
      0,
      EXCERPTS_PER_MATCH_LIMIT,
    );
    const registered = service.resources.find(
      (resource) => resource.kind === candidate.kind && resource.slug === candidate.slug,
    );
    const searchableText = [
      registered
        ? resourceSearchMetadataText(registered, (sourceId) =>
            service.registry.sources.getById(sourceId),
          )
        : [candidate.name, ...candidate.aliases, candidate.slug].join(" "),
      ...selected.map(({ content }) => content),
    ]
      .join(" ")
      .toLowerCase();
    const matchedTerms = tokens.filter((token) => searchableText.includes(token));

    matches.push({
      resource: withoutMatchReason(candidate),
      match_reason:
        relevant.length > 0
          ? `${candidate.matchReason}; matched governed Section content`
          : candidate.matchReason,
      matched_terms: matchedTerms,
      excerpts: selected.map(({ sectionId, section, content }) => ({
        section: SectionIdSchema.parse(sectionId),
        ...excerptAroundKeywords(content, tokens),
        citations: section.citations,
        warnings: section.warnings,
      })),
    });
  }

  return SearchContextResponseSchema.parse({ query: input.query, matches });
}

function withoutMatchReason(
  candidate: ReturnType<typeof searchResources>["items"][number],
): SearchContextResponse["matches"][number]["resource"] {
  const { matchReason: _matchReason, ...resource } = candidate;
  return resource;
}

function excerptAroundKeywords(
  content: string,
  tokens: string[],
): { text: string; truncated: boolean } {
  const lower = content.toLowerCase();
  const positions = tokens.map((token) => lower.indexOf(token)).filter((position) => position >= 0);
  const firstMatch = positions.length > 0 ? Math.min(...positions) : 0;
  const start = Math.max(0, firstMatch - EXCERPT_LEAD_CHARS);
  const end = Math.min(content.length, start + EXCERPT_CHAR_LIMIT);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < content.length ? "…" : "";
  return {
    text: `${prefix}${content.slice(start, end)}${suffix}`,
    truncated: start > 0 || end < content.length,
  };
}
