import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ContextBundleResponse, ContextRequest } from "@atlas/schema";

import {
  askAtlas as answerFromContextBundle,
  createDailyRateLimiter,
  type AskAtlasClaim,
  type LlmAdapter,
} from "@/ask/askAtlas";
import { createConfiguredClaimsAdapter } from "./llmProvider";
import { serverContextApiClient } from "./serverContextApiClient";

const askInputSchema = z.object({
  topicId: z.string().min(1).optional(),
  question: z.string().min(1),
});

type AskAtlasSourceRef = {
  source_id: string;
  title: string;
  authority_level: string;
  url?: string;
};

export type AskAtlasResponse = {
  answer: string;
  sources: ReadonlyArray<AskAtlasSourceRef>;
  warnings: ReadonlyArray<string>;
};

const rateLimiter = createDailyRateLimiter(100);

export const askAtlas = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => askInputSchema.parse(input))
  .handler(async ({ data }): Promise<AskAtlasResponse> => {
    const bundle = await serverContextApiClient.getContextBundle(
      buildAskContextRequest(data),
    );

    return createAskAtlasResponse({
      question: data.question,
      bundle,
      adapter: createConfiguredAdapter(bundle),
      userId: "anonymous",
    });
  });

export type AskAtlasClaimsAdapter = LlmAdapter;

export function buildAskContextRequest(input: {
  topicId?: string;
  question: string;
}): ContextRequest {
  return input.topicId ? { topic_id: input.topicId } : { query: input.question };
}

export async function createAskAtlasResponse(input: {
  question: string;
  bundle: ContextBundleResponse;
  adapter: AskAtlasClaimsAdapter;
  userId: string;
}): Promise<AskAtlasResponse> {
  try {
    const result = await answerFromContextBundle({
      question: input.question,
      bundle: input.bundle,
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
      sources: authoritativeSourceRefs(input.bundle),
      warnings,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "Ask Atlas daily limit exceeded.") {
      return { answer: "", sources: [], warnings: ["rate-limit-exceeded"] };
    }
    throw error;
  }
}

function createConfiguredAdapter(bundle: ContextBundleResponse): AskAtlasClaimsAdapter {
  return createConfiguredClaimsAdapter({ bundle });
}

function authoritativeSourceRefs(bundle: ContextBundleResponse): AskAtlasSourceRef[] {
  return bundle.sources.flatMap((source) =>
    source.source.authority_level === "authoritative"
      ? [
          {
            source_id: source.source.id,
            title: source.source.title,
            authority_level: source.source.authority_level,
            url: source.source.location,
          },
        ]
      : [],
  );
}

function formatClaims(claims: ReadonlyArray<AskAtlasClaim>): string {
  return claims
    .map((claim) => `${claim.text} ${claim.citation_ids.map((id) => `[${id}]`).join(" ")}`)
    .join("\n\n");
}
