import { z } from "zod";
import { logger, safeError } from "@atlas/logging";
import type { ResourceContextResponse } from "@atlas/schema";

import type { ContextApiClient } from "@/api/contextApiClient";
import type { AskAtlasRequest, AskAtlasResponse } from "@/api/portalContracts";
import {
  askAtlas as answerFromProjection,
  createDailyRateLimiter,
  type AskAtlasClaim,
  type LlmAdapter,
} from "@/ask/askAtlas";
import { createConfiguredClaimsAdapter } from "./llmProvider";
import { createServerContextApiClient } from "./httpContextApiClient";

const askInputSchema = z.object({
  resourceSlug: z.string().min(1).optional(),
  question: z.string().min(1),
});

type AskInput = z.infer<typeof askInputSchema>;

export type { AskAtlasResponse } from "@/api/portalContracts";

const rateLimiter = createDailyRateLimiter(100);
const log = logger("portal.ask");

export function parseAskAtlasRequest(input: unknown): AskAtlasRequest {
  return askInputSchema.parse(input);
}

export async function answerAskAtlas(input: {
  request: AskAtlasRequest;
  token?: string;
  signal?: AbortSignal;
}): Promise<AskAtlasResponse> {
  input.signal?.throwIfAborted();
  const client = createServerContextApiClient({ token: input.token });
  const projection = await resolveProjection(input.request, client, input.signal);
  if (!projection) {
    log.info({ event: "ask.completed", outcome: "no_evidence" }, "Ask completed without evidence");
    return { answer: "", sources: [], warnings: ["no governed evidence found"] };
  }

  return createAskAtlasResponse({
    question: input.request.question,
    projection,
    adapter: createConfiguredClaimsAdapter({ projection }),
    userId: "anonymous",
    signal: input.signal,
  });
}

export type AskAtlasClaimsAdapter = LlmAdapter;

/**
 * Resolve an ask to one governed Resource projection (plan 019). A resource-anchored
 * ask resolves its service through the availability spine; a free-text ask
 * resolves by resource search. Returns null when nothing matches — the caller
 * answers with an honest "no governed evidence" rather than inventing claims.
 */
async function resolveProjection(
  data: AskInput,
  client: ContextApiClient,
  signal?: AbortSignal,
): Promise<ResourceContextResponse | null> {
  const ref = await resolveResourceRef(data, client, signal);
  if (!ref) return null;
  try {
    return await client.getResourceContext(ref.kind, ref.slug, { signal });
  } catch (error) {
    if (signal?.aborted) throw signal.reason;
    log.warn(
      { event: "ask.projection.failed", err: safeError(error, "Ask projection failed") },
      "Ask projection failed",
    );
    return null;
  }
}

async function resolveResourceRef(
  data: AskInput,
  client: ContextApiClient,
  signal?: AbortSignal,
): Promise<{ kind: string; slug: string } | null> {
  // An anchored ask carries the service's canonical resource slug ({provider}/{id},
  // e.g. "aws/textract") — use it directly; getResourceContext degrades to null if
  // it does not resolve. A free-text ask resolves by resource search.
  if (data.resourceSlug) {
    return { kind: "service", slug: data.resourceSlug };
  }

  const search = await client.searchResources(data.question, { signal });
  const first = search.items[0];
  return first ? { kind: first.kind, slug: first.slug } : null;
}

export async function createAskAtlasResponse(input: {
  question: string;
  projection: ResourceContextResponse;
  adapter: AskAtlasClaimsAdapter;
  userId: string;
  signal?: AbortSignal;
}): Promise<AskAtlasResponse> {
  try {
    const result = await answerFromProjection({
      question: input.question,
      projection: input.projection,
      adapter: input.adapter,
      userId: input.userId,
      rateLimiter,
      signal: input.signal,
    });
    const warnings = [...result.warnings];

    if (result.rejected_claims.length > 0) {
      warnings.push("uncited-claims-rejected");
      log.warn(
        { event: "ask.claims.rejected", rejectedClaimCount: result.rejected_claims.length },
        "Uncited claims rejected",
      );
    }

    const sources = sourceRefs(input.projection);
    log.info(
      {
        event: "ask.completed",
        outcome: "success",
        acceptedClaimCount: result.claims.length,
        sourceCount: sources.length,
      },
      "Ask completed",
    );
    return {
      answer: formatClaims(result.claims),
      sources,
      warnings,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Ask Atlas daily limit exceeded.") {
      log.warn({ event: "ask.completed", outcome: "rate_limited" }, "Ask rate limited");
      return { answer: "", sources: [], warnings: ["rate-limit-exceeded"] };
    }
    throw error;
  }
}

/** Distinct cited Sources across the projection, in first-seen order. */
function sourceRefs(projection: ResourceContextResponse): AskAtlasResponse["sources"] {
  const seen = new Map<string, AskAtlasResponse["sources"][number]>();
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
