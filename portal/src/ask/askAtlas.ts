import type { ContextBundleResponse } from "@atlas/schema";

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

export function buildAskAtlasPrompt(input: {
  question: string;
  bundle: ContextBundleResponse;
}): string {
  const excerpts = input.bundle.sources.flatMap((source) =>
    source.source.authority_level === "authoritative"
      ? source.excerpts.map(
          (excerpt) =>
            `[${citationId(excerpt.citation.source_id, excerpt.citation.anchor_id)}] ${excerpt.text}`,
        )
      : [],
  );

  return [
    `Question: ${input.question}`,
    "Use only these Atlas context bundle excerpts.",
    ...excerpts,
  ].join("\n");
}

export function validateCitations(input: {
  bundle: ContextBundleResponse;
  claims: AskAtlasClaim[];
}): CitationValidationResult {
  const allowedCitationIds = new Set(
    input.bundle.sources.flatMap((source) =>
      source.source.authority_level === "authoritative"
        ? source.excerpts.map((excerpt) =>
            citationId(excerpt.citation.source_id, excerpt.citation.anchor_id),
          )
        : [],
    ),
  );

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
  bundle: ContextBundleResponse;
  adapter: LlmAdapter;
  userId: string;
  rateLimiter: RateLimiter;
}): Promise<AskAtlasAnswer> {
  if (!input.bundle.sources.some((source) => source.source.authority_level === "authoritative")) {
    return {
      claims: [],
      rejected_claims: [],
      warnings: ["no registered authoritative source found"],
    };
  }

  input.rateLimiter.consume(input.userId);
  const adapterResult = await input.adapter.answer(
    buildAskAtlasPrompt({ question: input.question, bundle: input.bundle }),
  );
  const validated = validateCitations({
    bundle: input.bundle,
    claims: adapterResult.claims,
  });

  return {
    ...validated,
    warnings: input.bundle.warnings.map((warning) => warning.code),
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

function citationId(sourceId: string, anchorId: string | undefined): string {
  return anchorId ? `${sourceId}#${anchorId}` : sourceId;
}
