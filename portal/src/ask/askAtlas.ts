import type { ResourceContextResponse } from "@atlas/schema";

export type AskAtlasClaim = {
  text: string;
  citation_ids: string[];
};

type LlmAdapterResult = {
  claims: AskAtlasClaim[];
};

export type LlmAdapter = {
  answer(prompt: string): Promise<LlmAdapterResult>;
};

export type CitationValidationResult = {
  claims: AskAtlasClaim[];
  rejected_claims: AskAtlasClaim[];
};

export type AskAtlasAnswer = CitationValidationResult & {
  warnings: string[];
};

export type RateLimiter = {
  consume(userId: string): void;
};

/**
 * Ask Atlas grounds answers in a live Resource projection (plan 019): every
 * cited excerpt is a governed Section's content + citation. Discovery's entry
 * scope already crawls only authoritative sources, so there is no per-source
 * authority gate — all discovered Section content is admissible evidence.
 */
export function buildAskAtlasPrompt(input: {
  question: string;
  projection: ResourceContextResponse;
}): string {
  const excerpts = Object.values(input.projection.sections).flatMap((section) => {
    if (!section.content || section.citations.length === 0) return [];
    const cites = section.citations
      .map((citation) => `[${citationId(citation.sourceId, citation.anchor)}]`)
      .join("");
    return [`${cites} ${section.content}`];
  });

  return [
    `Question: ${input.question}`,
    "Use only these governed Atlas resource excerpts.",
    ...excerpts,
  ].join("\n");
}

export function validateCitations(input: {
  projection: ResourceContextResponse;
  claims: AskAtlasClaim[];
}): CitationValidationResult {
  const allowedCitationIds = new Set(sectionCitationIds(input.projection));

  const claims: AskAtlasClaim[] = [];
  const rejectedClaims: AskAtlasClaim[] = [];

  for (const claim of input.claims) {
    if (
      claim.citation_ids.length > 0 &&
      claim.citation_ids.every((citation) => allowedCitationIds.has(citation))
    ) {
      claims.push(claim);
    } else {
      rejectedClaims.push(claim);
    }
  }

  return {
    claims,
    rejected_claims: rejectedClaims,
  };
}

export async function askAtlas(input: {
  question: string;
  projection: ResourceContextResponse;
  adapter: LlmAdapter;
  userId: string;
  rateLimiter: RateLimiter;
}): Promise<AskAtlasAnswer> {
  if (!hasGovernedEvidence(input.projection)) {
    return {
      claims: [],
      rejected_claims: [],
      warnings: ["no governed evidence found"],
    };
  }

  input.rateLimiter.consume(input.userId);
  const adapterResult = await input.adapter.answer(
    buildAskAtlasPrompt({ question: input.question, projection: input.projection }),
  );
  const validated = validateCitations({
    projection: input.projection,
    claims: adapterResult.claims,
  });

  return {
    ...validated,
    warnings: projectionWarningCodes(input.projection),
  };
}

export function createDailyRateLimiter(maxRequests: number): RateLimiter {
  const counts = new Map<string, number>();

  return {
    consume(userId: string): void {
      const count = counts.get(userId) ?? 0;
      if (count >= maxRequests) {
        throw new Error("Ask Atlas daily limit exceeded.");
      }
      counts.set(userId, count + 1);
    },
  };
}

/** Every citation id (`source_id#anchor`) across the projection's Sections. */
export function sectionCitationIds(projection: ResourceContextResponse): string[] {
  return Object.values(projection.sections).flatMap((section) =>
    section.citations.map((citation) => citationId(citation.sourceId, citation.anchor)),
  );
}

/** At least one Section resolved to real content with a citation to ground it. */
function hasGovernedEvidence(projection: ResourceContextResponse): boolean {
  return Object.values(projection.sections).some(
    (section) => Boolean(section.content) && section.citations.length > 0,
  );
}

function projectionWarningCodes(projection: ResourceContextResponse): string[] {
  return [
    ...Object.values(projection.sections).flatMap((section) =>
      section.warnings.map((warning) => warning.code),
    ),
    ...projection.missingSections.map((missing) => missing.code),
  ];
}

function citationId(sourceId: string, anchorId: string | undefined): string {
  return anchorId ? `${sourceId}#${anchorId}` : sourceId;
}
