import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ResourceContextResponse } from "@atlas/schema";
import { logger, serializeError, errorSummary } from "@atlas/context-layer";

import {
  askAtlas as answerFromProjection,
  createDailyRateLimiter,
  type AskAtlasClaim,
  type LlmAdapter,
} from "@/ask/askAtlas";
import { createConfiguredClaimsAdapter } from "./llmProvider";
import { serverContextApiClient } from "./serverContextApiClient";

const askInputSchema = z.object({
  resourceSlug: z.string().min(1).optional(),
  question: z.string().min(1),
});

type AskInput = z.infer<typeof askInputSchema>;

type AskAtlasSourceRef = {
  source_id: string;
  title: string;
  url: string;
};

export type AskAtlasResponse = {
  answer: string;
  sources: ReadonlyArray<AskAtlasSourceRef>;
  warnings: ReadonlyArray<string>;
};

const rateLimiter = createDailyRateLimiter(100);

export const askAtlas = createServerFn({ method: "POST" })
  .validator((input: unknown) => askInputSchema.parse(input))
  .handler(async ({ data }): Promise<AskAtlasResponse> => {
    const projection = await resolveProjection(data);
    if (!projection) {
      return { answer: "", sources: [], warnings: ["no governed evidence found"] };
    }

    return createAskAtlasResponse({
      question: data.question,
      projection,
      adapter: createConfiguredClaimsAdapter({ projection }),
      userId: "anonymous",
    });
  });

export type AskAtlasClaimsAdapter = LlmAdapter;

/**
 * Resolve an ask to one governed Resource projection (plan 019). A resource-anchored
 * ask resolves its service through the availability spine; a free-text ask
 * resolves by resource search. Returns null when nothing matches — the caller
 * answers with an honest "no governed evidence" rather than inventing claims.
 */
async function resolveProjection(data: AskInput): Promise<ResourceContextResponse | null> {
  const ref = await resolveResourceRef(data);
  if (!ref) return null;
  try {
    return await serverContextApiClient.getResourceContext(ref.kind, ref.slug);
  } catch (error) {
    logger("ask").warn(
      { kind: ref.kind, slug: ref.slug, err: serializeError(error) },
      `ask: resource context resolution failed for ${ref.kind}/${ref.slug} — answering with no evidence`,
    );
    return null;
  }
}

async function resolveResourceRef(data: AskInput): Promise<{ kind: string; slug: string } | null> {
  // An anchored ask carries the service's canonical resource slug ({provider}/{id},
  // e.g. "aws/textract") — use it directly; getResourceContext degrades to null if
  // it does not resolve. A free-text ask resolves by resource search.
  if (data.resourceSlug) {
    return { kind: "service", slug: data.resourceSlug };
  }

  const search = await serverContextApiClient.searchResources(data.question);
  const first = search.items[0];
  return first ? { kind: first.kind, slug: first.slug } : null;
}

export async function createAskAtlasResponse(input: {
  question: string;
  projection: ResourceContextResponse;
  adapter: AskAtlasClaimsAdapter;
  userId: string;
}): Promise<AskAtlasResponse> {
  try {
    const result = await answerFromProjection({
      question: input.question,
      projection: input.projection,
      adapter: input.adapter,
      userId: input.userId,
      rateLimiter,
    });
    const warnings = [...result.warnings];

    if (result.rejected_claims.length > 0) {
      warnings.push("uncited-claims-rejected");
    }

    return {
      answer: formatClaims(result.claims),
      sources: sourceRefs(input.projection),
      warnings,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Ask Atlas daily limit exceeded.") {
      return { answer: "", sources: [], warnings: ["rate-limit-exceeded"] };
    }
    // Everything else (e.g. an unreachable LLM endpoint surfacing as a bare
    // `fetch failed`) was rethrown uncaught to the framework logger, which prints
    // only `error.message`. Log the cause here before it propagates.
    logger("ask").error({ err: serializeError(error) }, `ask atlas failed: ${errorSummary(error)}`);
    throw error;
  }
}

/** Distinct cited Sources across the projection, in first-seen order. */
function sourceRefs(projection: ResourceContextResponse): AskAtlasSourceRef[] {
  const seen = new Map<string, AskAtlasSourceRef>();
  for (const section of Object.values(projection.sections)) {
    for (const citation of section.citations) {
      if (!seen.has(citation.sourceId)) {
        seen.set(citation.sourceId, {
          source_id: citation.sourceId,
          title: citation.title,
          url: citation.url,
        });
      }
    }
  }
  return [...seen.values()];
}

function formatClaims(claims: ReadonlyArray<AskAtlasClaim>): string {
  return claims
    .map((claim) => `${claim.text} ${claim.citation_ids.map((id) => `[${id}]`).join(" ")}`)
    .join("\n\n");
}
